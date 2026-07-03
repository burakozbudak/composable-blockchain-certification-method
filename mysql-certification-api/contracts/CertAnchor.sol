// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CertAnchor - HydroCert sertifika hash'lerini zincire sabitler
/// @notice MySQL'de olusturulan her sertifikanin ozet (keccak256) degerini
///         zincire yazar; boylece veritabani kaydinin sonradan
///         degistirilmedigi zincir uzerinden kanitlanabilir.
contract CertAnchor {
    struct Anchor {
        bytes32 dataHash;
        uint64 anchoredAt;
    }

    address public immutable issuer;
    mapping(bytes32 => Anchor) private anchors;

    event CertificateAnchored(
        bytes32 indexed serialHash,
        bytes32 dataHash,
        uint256 timestamp
    );

    error OnlyIssuer();
    error AlreadyAnchored();

    constructor() {
        issuer = msg.sender;
    }

    /// @param serialHash keccak256(seri_no)
    /// @param dataHash   sertifika alanlarinin kanonik JSON ozeti
    function anchorCertificate(bytes32 serialHash, bytes32 dataHash) external {
        if (msg.sender != issuer) revert OnlyIssuer();
        if (anchors[serialHash].anchoredAt != 0) revert AlreadyAnchored();
        anchors[serialHash] = Anchor(dataHash, uint64(block.timestamp));
        emit CertificateAnchored(serialHash, dataHash, block.timestamp);
    }

    /// @return exists     bu seri no zincire sabitlenmis mi
    /// @return valid      verilen veri ozeti zincirdekiyle eslesiyor mu
    /// @return anchoredAt sabitlenme zamani (unix)
    function verifyCertificate(bytes32 serialHash, bytes32 dataHash)
        external
        view
        returns (bool exists, bool valid, uint64 anchoredAt)
    {
        Anchor memory a = anchors[serialHash];
        exists = a.anchoredAt != 0;
        valid = exists && a.dataHash == dataHash;
        anchoredAt = a.anchoredAt;
    }
}
