pragma solidity ^0.6.2;

import {IPReceiver} from "../interfaces/IPReceiver.sol";

contract PReceiver is IPReceiver {
    event UserData(uint256 amount, bytes data);

    function receiveUserData(uint256 amount, bytes calldata userData) external override {
        emit UserData(amount, userData);
    }
}

contract PReceiverReverting is IPReceiver {
    function receiveUserData(uint256, bytes calldata) external override {
        require(false, "Revert!");
    }
}

contract NotImplementingReceiveUserDataFxn {}

contract PReceiverRevertingReturnBombing is IPReceiver {
    function receiveUserData(uint256, bytes calldata) external override {
        assembly {
            return(0, 1000000)
        }
    }
}

contract PReceiverRevertingReturnBombingReverting is IPReceiver {
    function receiveUserData(uint256, bytes calldata) external override {
        assembly {
            revert(0, 1000000)
        }
    }
}
