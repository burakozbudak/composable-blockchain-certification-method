// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EnergyStream — Composable Blockchain Certification (Hardhat Edition)
 * @author Burak Ozbudak — BBG 664 Term Project
 * @notice Composable, single-file reference implementation of the EnergyStream
 *         certification framework described in
 *         "Bridging EU CBAM and RED III — A Composable Blockchain Framework
 *          for the Turkey–EU Hydrogen Corridor".
 *
 *         The contract bundles four logically-separable components into one
 *         deployable artifact for easy Hardhat scenario testing:
 *
 *           1. Stream Registry         (operator + predicate configuration)
 *           2. Batch Submitter         (predicate engine on aggregate values)
 *           3. Dispute Resolver        (optimistic verification w/ slashing)
 *           4. Certificate Minter      (ERC-1155-lite green-H2 certificates)
 *
 *         Demo defaults:
 *           - Dispute window: 60 seconds (production: 24 hours)
 *           - 6-leaf Merkle example baked in
 *           - Verbose events for visual scenario traces
 */

contract EnergyStreamDemo {

    // ========================================================================
    // SECTION 1: DATA STRUCTURES
    // ========================================================================

    enum StreamStatus  { Inactive, Active, Suspended }
    enum BatchStatus   { Pending, Confirmed, Disputed, Invalidated }
    enum DisputeStatus { None, Active, Resolved }

    struct Stream {
        address operator;
        string  name;
        StreamStatus status;
        uint256 stakeAmount;
        uint256 batchCount;
        uint256 disputeCount;
        uint256 maxCarbonIntensity;   // RFNBO ceiling, 1e18 fixed-point
        uint256 minSpecificEnergy;    // PEM thermodynamic floor
        uint256 maxSpecificEnergy;    // PEM practical ceiling
    }

    struct Batch {
        uint256 streamId;
        address submitter;
        uint256 submittedAt;
        uint256 windowEndsAt;
        BatchStatus status;
        uint256 meanSpecificEnergy;   // kWh/kg H2 (1e18)
        uint256 meanCarbonIntensity;  // gCO2/kg H2 (1e18)
        uint256 totalProduction;      // kg H2 (1e18)
        uint256 leafCount;
        bytes32 merkleRoot;
        string  ipfsCID;
    }

    struct Dispute {
        uint256 batchId;
        address challenger;
        uint256 challengerStake;
        uint256 openedAt;
        DisputeStatus status;
        string  claimedReason;
        uint256 claimedTrueValue;
        bool    challengerWon;
    }

    // ========================================================================
    // SECTION 2: CONSTANTS (demo-tuned)
    // ========================================================================

    uint256 public constant MIN_STAKE       = 0.01 ether;
    uint256 public constant CHALLENGE_STAKE = 0.005 ether;
    uint256 public constant DISPUTE_WINDOW  = 60 seconds;
    uint256 public constant SLASH_AMOUNT    = 0.005 ether;

    // RFNBO ceiling: 3.38 kg CO2eq / kg H2 = 3380 gCO2/kg
    uint256 public constant DEFAULT_RFNBO_LIMIT    = 3380e18;
    // PEM thermodynamic floor: 39 kWh/kg
    uint256 public constant DEFAULT_PEM_MIN_ENERGY = 39e18;
    // PEM practical ceiling: 70 kWh/kg
    uint256 public constant DEFAULT_PEM_MAX_ENERGY = 70e18;

    // ========================================================================
    // SECTION 3: STATE
    // ========================================================================

    uint256 public nextStreamId  = 1;
    uint256 public nextBatchId   = 1;
    uint256 public nextDisputeId = 1;

    mapping(uint256 => Stream)  public streams;
    mapping(uint256 => Batch)   public batches;
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => uint256) public batchToDispute;

    // ERC-1155-lite (certificate book-keeping)
    mapping(uint256 => mapping(address => uint256)) public balanceOf;
    mapping(uint256 => bool) public mintedFlag;

    // ========================================================================
    // SECTION 4: EVENTS (verbose for scenario tracing)
    // ========================================================================

    event StreamRegistered(uint256 indexed streamId, address indexed operator, string name, uint256 stake);
    event PredicatesConfigured(uint256 indexed streamId, uint256 maxCarbonIntensity, uint256 minSpecificEnergy, uint256 maxSpecificEnergy);
    event BatchSubmitted(uint256 indexed batchId, uint256 indexed streamId, address indexed submitter, uint256 productionKg, uint256 carbonIntensity, uint256 windowEndsAt);
    event PredicateChecked(uint256 indexed batchId, string predicateName, bool passed, uint256 measuredValue, uint256 thresholdValue);
    event BatchConfirmed(uint256 indexed batchId, uint256 confirmedAt);
    event ChallengeOpened(uint256 indexed disputeId, uint256 indexed batchId, address indexed challenger, string reason);
    event DisputeResolved(uint256 indexed disputeId, uint256 indexed batchId, bool challengerWon, uint256 recomputedValue, uint256 claimedValue);
    event StakeSlashed(uint256 indexed streamId, address indexed from, address indexed to, uint256 amount);
    event CertificateMinted(uint256 indexed batchId, address indexed recipient, uint256 amountKg, string ipfsURI);

    // ========================================================================
    // SECTION 5: ERRORS
    // ========================================================================

    error InsufficientStake(uint256 sent, uint256 required);
    error StreamNotActive();
    error NotOperator();
    error BatchNotPending();
    error WindowStillOpen();
    error WindowClosed();
    error AlreadyDisputed();
    error AlreadyMinted();
    error InvalidLeafCount();
    error EmptyBatch();

    // ========================================================================
    // SECTION 6: STREAM REGISTRY
    // ========================================================================

    function registerStream(string calldata name)
        external
        payable
        returns (uint256 streamId)
    {
        if (msg.value < MIN_STAKE) revert InsufficientStake(msg.value, MIN_STAKE);

        streamId = nextStreamId++;

        streams[streamId] = Stream({
            operator:            msg.sender,
            name:                name,
            status:              StreamStatus.Active,
            stakeAmount:         msg.value,
            batchCount:          0,
            disputeCount:        0,
            maxCarbonIntensity:  DEFAULT_RFNBO_LIMIT,
            minSpecificEnergy:   DEFAULT_PEM_MIN_ENERGY,
            maxSpecificEnergy:   DEFAULT_PEM_MAX_ENERGY
        });

        emit StreamRegistered(streamId, msg.sender, name, msg.value);
        emit PredicatesConfigured(streamId, DEFAULT_RFNBO_LIMIT, DEFAULT_PEM_MIN_ENERGY, DEFAULT_PEM_MAX_ENERGY);
    }

    // ========================================================================
    // SECTION 7: BATCH SUBMITTER + PREDICATE ENGINE
    // ========================================================================

    function submitBatch(
        uint256 streamId,
        bytes32 merkleRoot,
        string calldata ipfsCID,
        uint256 meanSpecificEnergy,
        uint256 meanCarbonIntensity,
        uint256 totalProduction,
        uint256 leafCount
    )
        external
        returns (uint256 batchId)
    {
        Stream storage s = streams[streamId];

        if (s.status != StreamStatus.Active) revert StreamNotActive();
        if (s.operator != msg.sender)        revert NotOperator();

        if (totalProduction == 0) revert EmptyBatch();
        if (leafCount < 6 || leafCount > 86400) revert InvalidLeafCount();

        batchId = nextBatchId++;

        // Predicate 1: RFNBO carbon intensity ceiling
        bool p1 = meanCarbonIntensity <= s.maxCarbonIntensity;
        emit PredicateChecked(batchId, "RFNBO_CarbonIntensity_Limit", p1, meanCarbonIntensity, s.maxCarbonIntensity);
        require(p1, "Carbon intensity exceeds RFNBO limit (3.38 kg CO2/kg H2)");

        // Predicate 2: Thermodynamic floor
        bool p2 = meanSpecificEnergy >= s.minSpecificEnergy;
        emit PredicateChecked(batchId, "PEM_Thermodynamic_Min", p2, meanSpecificEnergy, s.minSpecificEnergy);
        require(p2, "Specific energy below PEM thermodynamic limit (39 kWh/kg)");

        // Predicate 3: Practical ceiling
        bool p3 = meanSpecificEnergy <= s.maxSpecificEnergy;
        emit PredicateChecked(batchId, "PEM_Practical_Max", p3, meanSpecificEnergy, s.maxSpecificEnergy);
        require(p3, "Specific energy exceeds practical PEM ceiling (70 kWh/kg)");

        batches[batchId] = Batch({
            streamId:            streamId,
            submitter:           msg.sender,
            submittedAt:         block.timestamp,
            windowEndsAt:        block.timestamp + DISPUTE_WINDOW,
            status:              BatchStatus.Pending,
            meanSpecificEnergy:  meanSpecificEnergy,
            meanCarbonIntensity: meanCarbonIntensity,
            totalProduction:     totalProduction,
            leafCount:           leafCount,
            merkleRoot:          merkleRoot,
            ipfsCID:             ipfsCID
        });

        s.batchCount++;

        emit BatchSubmitted(batchId, streamId, msg.sender, totalProduction, meanCarbonIntensity, block.timestamp + DISPUTE_WINDOW);
    }

    function confirmBatch(uint256 batchId) external {
        Batch storage b = batches[batchId];
        if (b.status != BatchStatus.Pending) revert BatchNotPending();
        if (block.timestamp < b.windowEndsAt) revert WindowStillOpen();

        b.status = BatchStatus.Confirmed;
        emit BatchConfirmed(batchId, block.timestamp);
    }

    // ========================================================================
    // SECTION 8: DISPUTE RESOLVER (optimistic verification)
    // ========================================================================

    function openChallenge(
        uint256 batchId,
        string calldata reason,
        uint256 claimedTrueValue
    )
        external
        payable
        returns (uint256 disputeId)
    {
        if (msg.value < CHALLENGE_STAKE) revert InsufficientStake(msg.value, CHALLENGE_STAKE);

        Batch storage b = batches[batchId];
        if (b.status != BatchStatus.Pending) revert BatchNotPending();
        if (block.timestamp >= b.windowEndsAt) revert WindowClosed();
        if (batchToDispute[batchId] != 0) revert AlreadyDisputed();

        disputeId = nextDisputeId++;

        disputes[disputeId] = Dispute({
            batchId:          batchId,
            challenger:       msg.sender,
            challengerStake:  msg.value,
            openedAt:         block.timestamp,
            status:           DisputeStatus.Active,
            claimedReason:    reason,
            claimedTrueValue: claimedTrueValue,
            challengerWon:    false
        });

        batchToDispute[batchId] = disputeId;
        b.status = BatchStatus.Disputed;

        emit ChallengeOpened(disputeId, batchId, msg.sender, reason);
    }

    function submitProofAndResolve(
        uint256 disputeId,
        uint256[] calldata leaves
    )
        external
    {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Active, "Dispute not active");

        Batch storage b = batches[d.batchId];
        Stream storage s = streams[b.streamId];

        require(leaves.length == b.leafCount, "Leaf count mismatch with batch");

        uint256 sum = 0;
        for (uint256 i = 0; i < leaves.length; i++) {
            sum += leaves[i];
        }
        uint256 recomputedMean = sum / leaves.length;

        bool aggregatorWasWrong = (recomputedMean != b.meanCarbonIntensity);

        d.challengerWon = aggregatorWasWrong;
        d.status = DisputeStatus.Resolved;

        if (aggregatorWasWrong) {
            b.status = BatchStatus.Invalidated;
            s.disputeCount++;

            uint256 slashAmt = SLASH_AMOUNT;
            if (slashAmt > s.stakeAmount) slashAmt = s.stakeAmount;
            s.stakeAmount -= slashAmt;

            (bool ok1, ) = d.challenger.call{value: d.challengerStake + slashAmt}("");
            require(ok1, "Refund+reward failed");

            emit StakeSlashed(b.streamId, b.submitter, d.challenger, slashAmt);
        } else {
            b.status = BatchStatus.Pending;
            (bool ok2, ) = b.submitter.call{value: d.challengerStake}("");
            require(ok2, "Reward failed");
        }

        emit DisputeResolved(disputeId, d.batchId, aggregatorWasWrong, recomputedMean, b.meanCarbonIntensity);
    }

    // ========================================================================
    // SECTION 9: CERTIFICATE MINTER (ERC-1155-lite)
    // ========================================================================

    function mintCertificate(uint256 batchId, address to) external {
        Batch storage b = batches[batchId];
        require(b.status == BatchStatus.Confirmed, "Batch not confirmed");
        require(!mintedFlag[batchId], "Already minted");
        require(to != address(0), "Invalid recipient");

        uint256 amountInKg = b.totalProduction / 1e18;

        balanceOf[batchId][to] = amountInKg;
        mintedFlag[batchId] = true;

        string memory uri = string(abi.encodePacked("ipfs://", b.ipfsCID));
        emit CertificateMinted(batchId, to, amountInKg, uri);
    }

    // ========================================================================
    // SECTION 10: VIEW HELPERS
    // ========================================================================

    function getStream(uint256 streamId) external view returns (Stream memory) {
        return streams[streamId];
    }

    function getBatch(uint256 batchId) external view returns (Batch memory) {
        return batches[batchId];
    }

    function getDispute(uint256 disputeId) external view returns (Dispute memory) {
        return disputes[disputeId];
    }

    function timeUntilWindowEnds(uint256 batchId) external view returns (int256) {
        Batch memory b = batches[batchId];
        return int256(b.windowEndsAt) - int256(block.timestamp);
    }

    function isMintable(uint256 batchId) external view returns (bool) {
        return batches[batchId].status == BatchStatus.Confirmed && !mintedFlag[batchId];
    }

    function demoMerkleRoot() external pure returns (bytes32) {
        return keccak256(abi.encodePacked("EnergyStream_demo_6leaf_2000avg"));
    }

    function demoCorrectLeaves() external pure returns (uint256[] memory) {
        uint256[] memory leaves = new uint256[](6);
        leaves[0] = 1900 ether;
        leaves[1] = 1950 ether;
        leaves[2] = 2000 ether;
        leaves[3] = 2050 ether;
        leaves[4] = 2100 ether;
        leaves[5] = 2000 ether;
        return leaves;
    }

    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
