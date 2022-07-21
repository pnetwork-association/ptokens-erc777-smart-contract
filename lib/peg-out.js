const { checkIsHex } = require('./utils')
const { getPTokenContract } = require('./get-ptoken-contract')
const { callFxnInContractAndAwaitReceipt } = require('./contract-utils')
const { checkTokenBalanceIsSufficient } = require('./check-token-balance')

const pegOut = (
  _deployedContractAddress,
  _amount,
  _recipient,
  _destinationChainId,
  _userData,
  _maybeGasPrice = null,
) =>
  checkIsHex(_userData)
    .then(_ => getPTokenContract(_deployedContractAddress))
    .then(checkTokenBalanceIsSufficient(_amount))
    .then(_contract =>
      callFxnInContractAndAwaitReceipt(
        'redeem(uint256,bytes,string,bytes4)',
        [ _amount, _userData, _recipient, _destinationChainId ],
        _maybeGasPrice,
        _contract,
      )
    )
    .then(_receipt => console.info('✔ Success! Transaction receipt:\n', _receipt))

module.exports = { pegOut }
