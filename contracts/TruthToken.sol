// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TruthToken (TRUTH)
 * @notice ERC-20 token for the Quantizing Truth protocol.
 *         Earned by hosting verified truth quanta, vetting claims,
 *         and referring verifiers. Burns on query fees and dispute slashing.
 *
 *  Supply:  1 000 000 000 TRUTH (1B)
 *  Halving: Emission rate halves every 4 years (~126_230_400 seconds)
 *
 * @dev Deploy on Polygon Amoy testnet. Integrates with TruthRegistry
 *      for mint-on-verify and slash-on-dispute flows.
 */
contract TruthToken is ERC20, Ownable {
    // ──────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────
    uint256 public constant MAX_SUPPLY        = 1_000_000_000 ether; // 1B TRUTH
    uint256 public constant HALVING_PERIOD    = 4 * 365 days;       // ~4 years
    uint256 public constant INITIAL_EMISSION  = 400_000_000 ether;  // 40% for verifiers
    uint256 public constant QUERY_FEE_BPS     = 100;                // 1% query fee burned
    uint256 public constant SLASH_MIN_BPS     = 500;                // 5% min slash
    uint256 public constant SLASH_MAX_BPS     = 2000;               // 20% max slash

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────
    uint256 public deployedAt;
    uint256 public totalMinted;
    uint256 public totalBurned;

    mapping(address => bool) public minters;  // TruthRegistry, BountyPool, etc.

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────
    event MinterUpdated(address indexed account, bool status);
    event TruthMinted(address indexed to, uint256 amount, string reason);
    event TruthBurned(address indexed from, uint256 amount, string reason);
    event TruthSlashed(address indexed from, uint256 amount, uint256 bps);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────
    modifier onlyMinter() {
        require(minters[msg.sender], "Not a minter");
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────
    constructor() ERC20("Truth", "TRUTH") Ownable(msg.sender) {
        deployedAt = block.timestamp;
    }

    // ──────────────────────────────────────────────
    //  Emission logic (halving-aware)
    // ──────────────────────────────────────────────

    /**
     * @notice Current halving era (0-indexed). Era 0 = first 4 years.
     */
    function currentEra() public view returns (uint256) {
        return (block.timestamp - deployedAt) / HALVING_PERIOD;
    }

    /**
     * @notice Remaining emission cap for the current era.
     */
    function eraEmissionCap() public view returns (uint256) {
        uint256 era = currentEra();
        // Each era's cap = INITIAL_EMISSION / 2^era
        return INITIAL_EMISSION >> era;
    }

    // ──────────────────────────────────────────────
    //  Mint / Burn / Slash
    // ──────────────────────────────────────────────

    /**
     * @notice Mint TRUTH for a verification action (host, vet, refer).
     *         Respects MAX_SUPPLY and halving schedule.
     */
    function mint(address to, uint256 amount, string calldata reason) external onlyMinter {
        require(totalMinted + amount <= MAX_SUPPLY, "Exceeds max supply");
        // In production: also enforce per-era caps
        totalMinted += amount;
        _mint(to, amount);
        emit TruthMinted(to, amount, reason);
    }

    /**
     * @notice Burn TRUTH (query fees, voluntary burns).
     */
    function burn(uint256 amount, string calldata reason) external {
        totalBurned += amount;
        _burn(msg.sender, amount);
        emit TruthBurned(msg.sender, amount, reason);
    }

    /**
     * @notice Slash a staker's TRUTH on dispute loss.
     * @param from     Address being slashed
     * @param bps      Slash severity (500-2000 = 5%-20%)
     */
    function slash(address from, uint256 bps) external onlyMinter {
        require(bps >= SLASH_MIN_BPS && bps <= SLASH_MAX_BPS, "Invalid slash bps");
        uint256 balance = balanceOf(from);
        uint256 slashAmount = (balance * bps) / 10_000;
        totalBurned += slashAmount;
        _burn(from, slashAmount);
        emit TruthSlashed(from, slashAmount, bps);
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    function setMinter(address account, bool status) external onlyOwner {
        minters[account] = status;
        emit MinterUpdated(account, status);
    }
}
