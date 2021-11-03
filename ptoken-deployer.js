#!/usr/bin/env node

require('dotenv').config()
const { docopt } = require('docopt')
const { pegOut } = require('./lib/peg-out')
const { version } = require('./package.json')
const { showBalanceOf } = require('./lib/get-balance-of')
const { flattenContract } = require('./lib/flatten-contract')
const { grantMinterRole } = require('./lib/grant-minter-role')
const { deployPTokenContract } = require('./lib/deploy-ptoken')
const { verifyPTokenContract } = require('./lib/verify-ptoken')
const { showSuggestedFees } = require('./lib/show-suggested-fees')
const { getEncodedInitArgs } = require('./lib/get-encoded-init-args')
const { showExistingPTokenContractAddresses } = require('./lib/show-existing-logic-contract-addresses')

const HELP_ARG = '--help'
const PEG_OUT_CMD = 'pegOut'
const AMOUNT_ARG = '<amount>'
const VERSION_ARG = '--version'
const NETWORK_ARG = '<network>'
const TOKEN_NAME_ARG = '<tokenName>'
const ETH_ADDRESS_ARG = '<ethAddress>'
const GET_BALANCE_CMD = 'getBalanceOf'
const TOOL_NAME = 'ptoken-deployer.js'
const TOKEN_SYMBOL_ARG = '<tokenSymbol>'
const DEPLOY_PTOKEN_CMD = 'deployPToken'
const VERIFY_PTOKEN_CMD = 'verifyPToken'
const USER_DATA_OPTIONAL_ARG = '--userData'
const RECIPIENT_ADDRESS_ARG = '<recipient>'
const FLATTEN_CONTRACT_CMD = 'flattenContract'
const GRANT_MINTER_ROLE_CMD = 'grantMinterRole'
const DEPLOYED_ADDRESS_ARG = '<deployedAddress>'
const TOKEN_ADMIN_ADDRESS_ARG = '<adminAddress>'
const SHOW_SUGGESTED_FEES_CMD = 'showSuggestedFees'
const GET_ENCODED_INIT_ARGS_CMD = 'getEncodedInitArgs'
const USER_DATA_ARG = `${USER_DATA_OPTIONAL_ARG}=<hex>`
const SHOW_EXISTING_CONTRACTS_CMD = 'showExistingContracts'

const USAGE_INFO = `
❍ pTokens ERC777 Deployer ❍

  Copyright Provable Things 2021
  Questions: greg@oraclize.it

❍ Info:

  A tool to aid with deployments of the upgradeable pToken ERC777 logic contract.

❍ Usage:
  ${TOOL_NAME} ${HELP_ARG}
  ${TOOL_NAME} ${VERSION_ARG}
  ${TOOL_NAME} ${DEPLOY_PTOKEN_CMD}
  ${TOOL_NAME} ${FLATTEN_CONTRACT_CMD}
  ${TOOL_NAME} ${SHOW_SUGGESTED_FEES_CMD}
  ${TOOL_NAME} ${SHOW_EXISTING_CONTRACTS_CMD}
  ${TOOL_NAME} ${VERIFY_PTOKEN_CMD} ${DEPLOYED_ADDRESS_ARG} ${NETWORK_ARG}
  ${TOOL_NAME} ${GET_BALANCE_CMD} ${DEPLOYED_ADDRESS_ARG} ${ETH_ADDRESS_ARG}
  ${TOOL_NAME} ${GRANT_MINTER_ROLE_CMD} ${DEPLOYED_ADDRESS_ARG} ${ETH_ADDRESS_ARG}
  ${TOOL_NAME} ${GET_ENCODED_INIT_ARGS_CMD} ${TOKEN_NAME_ARG} ${TOKEN_SYMBOL_ARG} ${TOKEN_ADMIN_ADDRESS_ARG}
  ${TOOL_NAME} ${PEG_OUT_CMD} ${DEPLOYED_ADDRESS_ARG} ${AMOUNT_ARG} ${RECIPIENT_ADDRESS_ARG} [${USER_DATA_ARG}]

❍ Commands:

  ${SHOW_SUGGESTED_FEES_CMD}     ❍ Show 'ethers.js' suggested fees.
  ${DEPLOY_PTOKEN_CMD}          ❍ Deploy the pToken logic contract.
  ${VERIFY_PTOKEN_CMD}          ❍ Verify a deployed pToken logic contract.
  ${GET_BALANCE_CMD}          ❍ Get balance of ${ETH_ADDRESS_ARG} of pToken at ${DEPLOYED_ADDRESS_ARG}.
  ${GET_ENCODED_INIT_ARGS_CMD}    ❍ Calculate the initializer function arguments in ABI encoded format.
  ${PEG_OUT_CMD}                ❍ Redeem ${AMOUNT_ARG} at ${DEPLOYED_ADDRESS_ARG} with optional ${USER_DATA_ARG}.
  ${FLATTEN_CONTRACT_CMD}       ❍ Flatten the pToken contract in case manual verification is required.
  ${GRANT_MINTER_ROLE_CMD}       ❍ Grant a minter role to ${ETH_ADDRESS_ARG} for pToken at ${DEPLOYED_ADDRESS_ARG}.
  ${SHOW_EXISTING_CONTRACTS_CMD} ❍ Show list of existing pToken logic contract addresses on various blockchains.

❍ Options:
  ${HELP_ARG}                ❍ Show this message.
  ${VERSION_ARG}             ❍ Show tool version.
  ${ETH_ADDRESS_ARG}          ❍ A valid ETH address.
  ${TOKEN_NAME_ARG}           ❍ The name of the pToken.
  ${TOKEN_SYMBOL_ARG}         ❍ The symbol of the pToken.
  ${DEPLOYED_ADDRESS_ARG}     ❍ The ETH address of the deployed pToken.
  ${RECIPIENT_ADDRESS_ARG}           ❍ The recipient of the pegged out pTokens.
  ${USER_DATA_ARG}      ❍ Optional user data in hex format [default: 0x].
  ${TOKEN_ADMIN_ADDRESS_ARG}        ❍ The ETH address which administrates the pToken.
  ${AMOUNT_ARG}              ❍ An amount in the most granular form of the token.
  ${NETWORK_ARG}             ❍ Network the pToken is deployed on. It must exist in the 'hardhat.config.json'.
`

const main = _ => {
  const CLI_ARGS = docopt(USAGE_INFO, { version })
  if (CLI_ARGS[DEPLOY_PTOKEN_CMD]) {
    return deployPTokenContract()
  } else if (CLI_ARGS[VERIFY_PTOKEN_CMD]) {
    return verifyPTokenContract(CLI_ARGS[DEPLOYED_ADDRESS_ARG], CLI_ARGS[NETWORK_ARG])
  } else if (CLI_ARGS[GET_ENCODED_INIT_ARGS_CMD]) {
    return getEncodedInitArgs(
      CLI_ARGS[TOKEN_NAME_ARG],
      CLI_ARGS[TOKEN_SYMBOL_ARG],
      CLI_ARGS[TOKEN_ADMIN_ADDRESS_ARG]
    )
      .then(console.info)
  } else if (CLI_ARGS[SHOW_SUGGESTED_FEES_CMD]) {
    return showSuggestedFees().then(console.table)
  } else if (CLI_ARGS[FLATTEN_CONTRACT_CMD]) {
    return flattenContract()
  } else if (CLI_ARGS[SHOW_EXISTING_CONTRACTS_CMD]) {
    return showExistingPTokenContractAddresses()
  } else if (CLI_ARGS[GRANT_MINTER_ROLE_CMD]) {
    return grantMinterRole(CLI_ARGS[DEPLOYED_ADDRESS_ARG], CLI_ARGS[ETH_ADDRESS_ARG])
  } else if (CLI_ARGS[GET_BALANCE_CMD]) {
    return showBalanceOf(CLI_ARGS[DEPLOYED_ADDRESS_ARG], CLI_ARGS[ETH_ADDRESS_ARG])
  } else if (CLI_ARGS[PEG_OUT_CMD]) {
    return pegOut(
      CLI_ARGS[DEPLOYED_ADDRESS_ARG],
      CLI_ARGS[AMOUNT_ARG],
      CLI_ARGS[RECIPIENT_ADDRESS_ARG],
      CLI_ARGS[USER_DATA_OPTIONAL_ARG],
    )
  }
}

main().catch(_err => console.error('✘', _err.message))
