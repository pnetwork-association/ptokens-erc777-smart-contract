/* eslint-disable-next-line no-shadow */
const ethers = require('ethers')
const { curry } = require('ramda')

const maybeStripHexPrefix = _hex =>
  _hex.startsWith('0x') ? _hex.slice(2) : _hex

const getEncodedInitArgs = (
  _tokenName,
  _tokenSymbol,
  _contractAdminAddress,
  _originChainId,
) => {
  console.info('✔ Encoding pToken initialization arguments...')
  /* eslint-disable-next-line max-len */
  const abiFragment = 'function initialize(string tokenName, string tokenSymbol, address defaultAdmin, bytes4 originChaindId)'
  return Promise.resolve(
    new ethers.Interface([ abiFragment ])
      .encodeFunctionData(
        'initialize',
        [ _tokenName, _tokenSymbol, _contractAdminAddress, _originChainId ],
      )
  )
}

const encodeProxyConstructorArgs = curry((_logicContract, _proxyAdmin, _encodedPTokenInitFxnCall) =>
  new Promise(resolve =>
    resolve(new ethers.AbiCoder().encode(
      ['address', 'address', 'bytes'],
      [ _logicContract, _proxyAdmin, _encodedPTokenInitFxnCall ]
    ))
  )
)

// NOTE: Because we may want this in future or if we have to manually verify a pToken.
/* eslint-disable-next-line no-unused-vars */
const getEncodedProxyConstructorArgs = (
  _tokenName,
  _tokenSymbol,
  _logicContract,
  _contractAdminAddress,
  _proxyAdmin,
  _originChainId,
) =>
  getEncodedInitArgs(_tokenName, _tokenSymbol, _contractAdminAddress, _originChainId)
    .then(encodeProxyConstructorArgs(_logicContract, _proxyAdmin))
    .then(maybeStripHexPrefix)

const showEncodedInitArgs = (_tokenName, _tokenSymbol, _contractAdminAddress, _originChainId) =>
  getEncodedInitArgs(_tokenName, _tokenSymbol, _contractAdminAddress, _originChainId)
    .then(console.info)

module.exports = {
  showEncodedInitArgs,
  getEncodedInitArgs,
}
