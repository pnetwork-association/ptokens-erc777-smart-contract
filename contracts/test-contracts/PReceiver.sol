pragma solidity ^0.6.2;

import {IPReceiver} from "../interfaces/IPReceiver.sol";

contract PReceiver is IPReceiver {
    event UserData(bytes data);

    function receiveUserData(bytes calldata userData) external override {
        emit UserData(userData);
    }
}

contract PReceiverReverting is IPReceiver {
    function receiveUserData(bytes calldata) external override {
        require(false, "Revert!");
    }
}

contract NotImplementingReceiveUserDataFxn {}

contract PReceiverRevertingReturnBombing is IPReceiver {
    function receiveUserData(bytes calldata) external override {
        assembly {
            return(0, 1000000)
        }
    }
}

contract PReceiverRevertingReturnBombingReverting is IPReceiver {
    function receiveUserData(bytes calldata) external override {
        assembly {
            revert(0, 1000000)
        }
    }
}
