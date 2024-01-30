pragma solidity ^0.6.2;

import {IPReceiver} from "./interfaces/IPReceiver.sol";
import "./ERC777WithAdminOperatorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @dev Note: Unfortunately we can't just refactor the original pToken to inherit most of this
 * logic, then have just the GSN version add the GSN specific logic because of the breaking
 * changes it would make to the storage layout, breaking the upgradeability. So alas, we have
 * this near clone to maintain instead.
 */
contract PTokenNoGSN is
    Initializable,
    AccessControlUpgradeable,
    ERC777WithAdminOperatorUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes4 public ORIGIN_CHAIN_ID;

    event ReceiveUserDataFailed();

    event Redeem(
        address indexed redeemer,
        uint256 value,
        string underlyingAssetRecipient,
        bytes userData,
        bytes4 originChainId,
        bytes4 destinationChainId
    );

    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        address defaultAdmin,
        bytes4 originChainId
    )
        public initializer
    {
        address[] memory defaultOperators;
        __AccessControl_init();
        __ERC777_init(tokenName, tokenSymbol, defaultOperators);
        __ERC777WithAdminOperatorUpgradeable_init(defaultAdmin);
        _setupRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        ORIGIN_CHAIN_ID = originChainId;
    }

    modifier onlyMinter {
        require(hasRole(MINTER_ROLE, _msgSender()), "Caller is not a minter");
        _;
    }

    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Caller is not an admin");
        _;
    }

    function mint(
        address recipient,
        uint256 value
    )
        external
        returns (bool)
    {
        mint(recipient, value, "", "");
        return true;
    }

    function mint(
        address recipient,
        uint256 value,
        bytes memory userData,
        bytes memory operatorData
    )
        public
        onlyMinter
        returns (bool)
    {
        require(
            recipient != address(this) ,
            "Recipient cannot be the token contract address!"
        );
        _mint(recipient, value, userData, operatorData);
        if (userData.length > 0) {
            // pNetwork aims to deliver cross chain messages successfully regardless of what the user may do with them.
            // We do not want this mint transaction reverting if their receiveUserData function reverts,
            // and thus we swallow any such errors, emitting a `ReceiveUserDataFailed` event instead.
            // The low-level call is used because in the solidity version this contract was written in,
            // a try/catch block fails to catch the revert caused if the receiver is not in fact a contract.
            // This way, a user also has the option include userData even when minting to an externally owned account.
            bytes memory data = abi.encodeWithSelector(IPReceiver.receiveUserData.selector, userData);
            (bool success, ) = recipient.call(data);
            if (!success) emit ReceiveUserDataFailed();
        }
        return true;
    }

    function redeem(
        uint256 amount,
        string calldata underlyingAssetRecipient,
        bytes4 destinationChainId
    )
        external
        returns (bool)
    {
        redeem(amount, "", underlyingAssetRecipient, destinationChainId);
        return true;
    }

    function redeem(
        uint256 amount,
        bytes memory userData,
        string memory underlyingAssetRecipient,
        bytes4 destinationChainId
    )
        public
    {
        _burn(_msgSender(), amount, userData, "");
        emit Redeem(
            _msgSender(),
            amount,
            underlyingAssetRecipient,
            userData,
            ORIGIN_CHAIN_ID,
            destinationChainId
        );
    }

    function operatorRedeem(
        address account,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData,
        string calldata underlyingAssetRecipient,
        bytes4 destinationChainId
    )
        external
    {
        require(
            isOperatorFor(_msgSender(), account),
            "ERC777: caller is not an operator for holder"
        );
        _burn(account, amount, userData, operatorData);
        emit Redeem(account, amount, underlyingAssetRecipient, userData, ORIGIN_CHAIN_ID, destinationChainId);
    }

    function grantMinterRole(address _account) external {
        grantRole(MINTER_ROLE, _account);
    }

    function revokeMinterRole(address _account) external {
        revokeRole(MINTER_ROLE, _account);
    }

    function hasMinterRole(address _account) external view returns (bool) {
        return hasRole(MINTER_ROLE, _account);
    }

    function changeOriginChainId(
        bytes4 _newOriginChainId
    )
        public
        onlyAdmin
        returns (bool success)
    {
        ORIGIN_CHAIN_ID = _newOriginChainId;
        return true;
    }
}
