// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITruthRegistryV2
 * @notice Minimal interface for TruthDAG to read from the deployed TruthRegistryV2.
 */
interface ITruthRegistryV2 {
    struct TruthScores {
        uint16 correspondence;
        uint16 coherence;
        uint16 convergence;
        uint16 pragmatism;
    }

    struct MoralVector {
        int16 care;
        int16 fairness;
        int16 loyalty;
        int16 authority;
        int16 sanctity;
        int16 liberty;
        int16 epistemicHumility;
        int16 temporalStewardship;
    }

    struct TruthQuantum {
        uint256 id;
        address host;
        bytes32 ipfsCid;
        string  discipline;
        string  claim;
        TruthScores truthScores;
        MoralVector moralVector;
        uint256 stakeAmount;
        uint8   status; // QuantumStatus enum
        uint256 createdAt;
        uint256 verifierCount;
        bytes32 erc8004AgentId;
    }

    function getQuantum(uint256 quantumId) external view returns (TruthQuantum memory);
    function aggregateTruthScore(uint256 quantumId) external view returns (uint256);
    function nextQuantumId() external view returns (uint256);

    function createQuantum(
        bytes32 ipfsCid,
        string calldata discipline,
        string calldata claim,
        TruthScores calldata initialTruthScores,
        MoralVector calldata initialMoralVector
    ) external returns (uint256 quantumId);
}
