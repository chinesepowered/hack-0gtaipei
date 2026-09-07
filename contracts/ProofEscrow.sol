// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgenticID {
    function getAgentSeal(uint256 agentId) external view returns (address);
}

/// @title ProofEscrow — pay-on-proof settlement for AI agent jobs on 0G
/// @notice A client funds a job for a specific agent. The agent is paid only when a
///         cryptographic receipt for the job is presented. Two receipt types:
///
///   (A) settle():         receipt signed by the agent's own key, binding
///                         (jobId, taskHash, outputHash, proofHash) where proofHash
///                         commits to the 0G Compute TEE proof of the inference.
///   (B) settleWithSeal(): an X-Agent-Proof ServeProof from a sealed 0G Agentic ID
///                         (ERC-7857) agent. The signer must be the agent's on-chain
///                         AgentSeal — a key that exists only inside the TEE — and the
///                         proof must name this job's client as submitter. Same digest
///                         as AgenticIDReputationRegistry, so one seal can both settle
///                         the escrow and earn ERC-8004 reputation.
contract ProofEscrow {
    struct Job {
        address client;
        address agent;      // (A) agent signing key; (B) payout address
        uint256 agentId;    // (B) Agentic ID token id; 0 for (A)
        bytes32 taskHash;   // keccak256 of the task text
        uint256 amount;
        uint64 deadline;    // after this the client may refund
        bool settled;
        bool refunded;
        bytes32 outputHash; // filled on settle
        bytes32 proofHash;  // filled on settle (A: TEE trace commitment; B: ServeProof taskHash)
    }

    /// @dev Mirrors IAgenticIDReputationRegistry.ServeProof
    struct ServeProof {
        uint256   agentId;
        address   submitter;
        uint256   timestamp;
        uint256   deadline;
        bytes32   taskHash;
        bytes32[] dataHashes;
        bytes32   frameworkHash;
        bytes     signature;
    }

    address public immutable agenticId; // ERC-7857 AgenticID (identity registry) used as the seal domain
    uint256 public jobCount;
    mapping(uint256 => Job) public jobs;
    mapping(bytes32 => bool) public usedProofs;

    event JobCreated(uint256 indexed id, address indexed client, address indexed agent, uint256 agentId, bytes32 taskHash, uint256 amount, uint64 deadline);
    event JobSettled(uint256 indexed id, address indexed agent, bytes32 outputHash, bytes32 proofHash, uint256 amount, bool viaSeal);
    event JobRefunded(uint256 indexed id, address indexed client, uint256 amount);

    constructor(address _agenticId) { agenticId = _agenticId; }

    /// @param agent   payout address (for (A) it must be the receipt signer)
    /// @param agentId 0 for key-signed receipts, else the sealed agent's ERC-7857 token id
    function createJob(address agent, uint256 agentId, bytes32 taskHash, uint64 deadline) external payable returns (uint256 id) {
        require(msg.value > 0, "no funds");
        require(agent != address(0), "no agent");
        require(deadline > block.timestamp, "bad deadline");
        id = ++jobCount;
        Job storage j = jobs[id];
        j.client = msg.sender; j.agent = agent; j.agentId = agentId; j.taskHash = taskHash; j.amount = msg.value; j.deadline = deadline;
        emit JobCreated(id, msg.sender, agent, agentId, taskHash, msg.value, deadline);
    }

    // ───────────────────────────── (A) key-signed receipt ─────────────────────────────

    function receiptDigest(uint256 id, bytes32 outputHash, bytes32 proofHash) public view returns (bytes32) {
        Job storage j = jobs[id];
        return keccak256(abi.encode(block.chainid, address(this), id, j.taskHash, outputHash, proofHash));
    }

    function settle(uint256 id, bytes32 outputHash, bytes32 proofHash, bytes calldata sig) external {
        Job storage j = _open(id);
        bytes32 digest = receiptDigest(id, outputHash, proofHash);
        require(_recover(_eth(digest), sig) == j.agent, "bad proof");
        _pay(j, id, outputHash, proofHash, false);
    }

    // ───────────────────────────── (B) X-Agent-Proof seal ─────────────────────────────

    /// @notice Same digest as AgenticIDReputationRegistry._verifyServeProof.
    function serveProofDigest(ServeProof calldata p) public view returns (bytes32) {
        return keccak256(abi.encode(
            block.chainid, agenticId, p.submitter, p.agentId, p.timestamp, p.deadline,
            p.taskHash, keccak256(abi.encodePacked(p.dataHashes)), p.frameworkHash
        ));
    }

    function settleWithSeal(uint256 id, bytes32 outputHash, ServeProof calldata p) external {
        Job storage j = _open(id);
        require(j.agentId != 0 && p.agentId == j.agentId, "wrong agent");
        require(p.submitter == j.client, "not served to client");
        require(block.timestamp <= p.deadline, "seal expired");
        address seal = IAgenticID(agenticId).getAgentSeal(p.agentId);
        require(seal != address(0), "no seal");
        bytes32 digest = serveProofDigest(p);
        require(!usedProofs[digest], "seal reused");
        require(_recover(_eth(digest), p.signature) == seal, "bad seal");
        usedProofs[digest] = true;
        _pay(j, id, outputHash, p.taskHash, true);
    }

    // ───────────────────────────── refund / internals ─────────────────────────────

    function refund(uint256 id) external {
        Job storage j = jobs[id];
        require(msg.sender == j.client, "not client");
        require(!j.settled && !j.refunded, "closed");
        require(block.timestamp > j.deadline, "not expired");
        j.refunded = true;
        (bool ok, ) = j.client.call{value: j.amount}("");
        require(ok, "refund failed");
        emit JobRefunded(id, j.client, j.amount);
    }

    function _open(uint256 id) internal view returns (Job storage j) {
        j = jobs[id];
        require(j.amount > 0, "no job");
        require(!j.settled && !j.refunded, "closed");
        require(block.timestamp <= j.deadline, "expired");
    }

    function _pay(Job storage j, uint256 id, bytes32 outputHash, bytes32 proofHash, bool viaSeal) internal {
        j.settled = true; j.outputHash = outputHash; j.proofHash = proofHash;
        (bool ok, ) = j.agent.call{value: j.amount}("");
        require(ok, "pay failed");
        emit JobSettled(id, j.agent, outputHash, proofHash, j.amount, viaSeal);
    }

    function _eth(bytes32 h) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h));
    }

    function _recover(bytes32 h, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "sig len");
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "bad v");
        return ecrecover(h, v, r, s);
    }
}
