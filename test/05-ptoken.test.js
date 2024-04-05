const { expect } = require('chai')
const { ethers, upgrades } = require('hardhat')
const {
  EMPTY_DATA,
  TOKEN_NAME,
  ZERO_ADDRESS,
  TOKEN_SYMBOL,
  ORIGIN_CHAIN_ID,
  DESTINATION_CHAIN_ID,
} = require('./test-constants')
const {
  getTokenBalance,
  mintTokensToAccounts,
} = require('./test-utils')
const {
  getPtokenContractWithGSN,
  getPtokenContractWithoutGSN,
} = require('./test-utils')
const assert = require('assert')

const USE_GSN = [ true, false ]

USE_GSN.map(_useGSN =>
  describe(`pToken Tests WITH${_useGSN ? '' : 'OUT'} GSN`, () => {
    const AMOUNT = 1337
    const ASSET_RECIPIENT = 'an address'
    let OWNER, NON_OWNER, MINTER, OTHERS, CONTRACT

    beforeEach(async () => {
      [ OWNER, NON_OWNER, MINTER, ...OTHERS ] = await ethers.getSigners()
      const contractGetterFxn = _useGSN ? getPtokenContractWithGSN : getPtokenContractWithoutGSN
      CONTRACT = await contractGetterFxn([
        TOKEN_NAME,
        TOKEN_SYMBOL,
        OWNER.address,
        ORIGIN_CHAIN_ID,
      ])
      await CONTRACT.grantMinterRole(OWNER.address)
    })

    describe('Initialization Tests', () => {
      it('Origin chain id should be set correctly on deployment', async () => {
        assert.strictEqual(await CONTRACT.ORIGIN_CHAIN_ID(), ORIGIN_CHAIN_ID)
      })
    })

    describe('Roles Tests', () => {
      it('Owner has \'default admin\' role', async () => {
        assert(await CONTRACT.hasRole(await CONTRACT.DEFAULT_ADMIN_ROLE(), OWNER.address))
      })

      it('Owner has \'minter\' role', async () => {
        assert(await CONTRACT.hasMinterRole(OWNER.address))
      })

      it('Owner can grant `minter` role', async () => {
        assert(!await CONTRACT.hasMinterRole(MINTER.address))
        await CONTRACT.grantMinterRole(MINTER.address)
        assert(await CONTRACT.hasMinterRole(MINTER.address))
      })

      it('Owner can revoke `minter` role', async () => {
        await CONTRACT.grantMinterRole(MINTER.address)
        assert(await CONTRACT.hasMinterRole(MINTER.address))
        await CONTRACT.revokeMinterRole(MINTER.address)
        assert(!await CONTRACT.hasMinterRole(MINTER.address))
      })

      it('Newly added minter should be able to mint tokens & emit correct events', async () => {
        await CONTRACT.grantMinterRole(MINTER.address)
        const recipient = OTHERS[0].address
        const tx = CONTRACT.connect(MINTER)['mint(address,uint256)'](recipient, AMOUNT)
        await expect(tx).to.changeTokenBalance(CONTRACT, recipient, AMOUNT)
        await expect(tx).to.emit(CONTRACT, 'Transfer')
          .withArgs(ZERO_ADDRESS, recipient, AMOUNT)
          .and.to.emit(CONTRACT, 'Minted')
          .withArgs(MINTER.address, recipient, AMOUNT, EMPTY_DATA, EMPTY_DATA)
      })

      it('Should grant minter role to EOA', async () => {
        const role = ethers.solidityPackedKeccak256(['string'], [ 'MINTER_ROLE' ])
        const address = '0xedB86cd455ef3ca43f0e227e00469C3bDFA40628'
        const hasRoleBefore = await CONTRACT.hasRole(role, address)
        assert(!hasRoleBefore)
        await CONTRACT.grantRole(role, address)
        const hasRoleAfter = await CONTRACT.hasRole(role, address)
        assert(hasRoleAfter)
      })
    })

    describe('Mint Tests', () => {
      it('`mint()` w/out data should mint tokens & emit correct events', async () => {
        const expectedNumEvents = 2
        const recipient = OTHERS[5].address
        const tx = await CONTRACT['mint(address,uint256)'](recipient, AMOUNT)
        const { logs } = await tx.wait()
        assert.strictEqual(logs.length, expectedNumEvents)
        await expect(tx).to.changeTokenBalance(CONTRACT, recipient, AMOUNT)
        await expect(tx).to.emit(CONTRACT, 'Transfer').withArgs(ZERO_ADDRESS, recipient, AMOUNT)
          .and.to.emit(CONTRACT, 'Minted').withArgs(OWNER.address, recipient, AMOUNT, EMPTY_DATA, EMPTY_DATA)
      })

      it('`mint()` w/out data should return true if successful', async () => {
        const recipient = OTHERS[0].address
        await CONTRACT['mint(address,uint256)'](recipient, AMOUNT)
      })

      it('`mint()` cannot mint to zero address', async () => {
        const recipient = ZERO_ADDRESS
        const recipientBalanceBefore = await getTokenBalance(recipient, CONTRACT)
        expect(recipientBalanceBefore).to.be.eq(0)
        const expectedError = 'ERC777: mint to the zero address'
        await expect(CONTRACT['mint(address,uint256)'](recipient, AMOUNT)).to.be.revertedWith(expectedError)
      })

      it('`mint()` only owner can mint', async () => {
        const recipient = ZERO_ADDRESS
        const recipientBalanceBefore = await getTokenBalance(recipient, CONTRACT)
        expect(recipientBalanceBefore).to.be.eq(0)
        const expectedError = 'Caller is not a minter'
        await expect(CONTRACT.connect(NON_OWNER)['mint(address,uint256)'](recipient, AMOUNT))
          .to.be.revertedWith(expectedError)
      })

      it('`mint()` w/ data should mint tokens to a non-contract address & emit correct events', async () => {
        const data = '0xdead'
        const operatorData = '0xb33f'
        const recipient = OTHERS[0].address
        const tx = CONTRACT['mint(address,uint256,bytes,bytes)'](recipient, AMOUNT, data, operatorData)
        await expect(tx).to.changeTokenBalance(CONTRACT, recipient, AMOUNT)
        await expect(tx).to.emit(CONTRACT, 'Transfer')
          .withArgs(ZERO_ADDRESS, recipient, AMOUNT)
          .and.to.emit(CONTRACT, 'Minted')
          .withArgs(OWNER.address, recipient, AMOUNT, data, operatorData)
      })

      it('`mint()` w/ data should mint & call receiveUserData & emit correct events', async () => {
        const data = '0xdead'
        const operatorData = '0xb33f'
        const recipientContract = await ethers
          .getContractFactory('contracts/test-contracts/PReceiver.sol:PReceiver')
          .then(_factory => upgrades.deployProxy(_factory))

        const tx = CONTRACT['mint(address,uint256,bytes,bytes)'](recipientContract.target, AMOUNT, data, operatorData)
        await expect(tx).to.changeTokenBalance(CONTRACT, recipientContract, AMOUNT)
        await expect(tx).to.emit(CONTRACT, 'Transfer')
          .withArgs(ZERO_ADDRESS, recipientContract.target, AMOUNT)
          .and.to.emit(CONTRACT, 'Minted')
          .withArgs(OWNER.address, recipientContract.target, AMOUNT, data, operatorData)
          .and.to.emit(recipientContract, 'UserData')
          .withArgs(AMOUNT, data)
      })

      // eslint-disable-next-line max-len
      it('`mint()` w/ `userData` should mint tokens, emit correct events & not revert despite `receiveUserData` hook being not implemented',
        async () => {
          const data = '0xdead'
          const operatorData = '0xb33f'
          const recipientContract = await ethers
            .getContractFactory('contracts/test-contracts/PReceiver.sol:NotImplementingReceiveUserDataFxn')
            .then(_factory => upgrades.deployProxy(_factory))

          const tx = CONTRACT['mint(address,uint256,bytes,bytes)'](recipientContract.target, AMOUNT, data, operatorData)
          await expect(tx).to.changeTokenBalance(CONTRACT, recipientContract, AMOUNT)
          await expect(tx).to.emit(CONTRACT, 'Transfer').withArgs(ZERO_ADDRESS, recipientContract.target, AMOUNT)
            .and.to.emit(CONTRACT, 'Minted')
            .withArgs(OWNER.address, recipientContract.target, AMOUNT, data, operatorData)
            .and.to.emit(CONTRACT, 'ReceiveUserDataFailed')
        })

      it('`mint()` w/ `userData` should mint tokens, emit correct events & not go OOG when receiver returnbombs',
        async () => {
          const data = '0xdead'
          const operatorData = '0xb33f'
          const recipientContract = await ethers
            .getContractFactory('contracts/test-contracts/PReceiver.sol:PReceiverRevertingReturnBombing')
            .then(_factory => _factory.deploy())
          // the return in receiveUserData consumes ~2M gas, thus provide the tx enough gas
          // to cover receiveUserData execution but not for copying bytes into caller context
          const tx = CONTRACT['mint(address,uint256,bytes,bytes)'](
            recipientContract.target, AMOUNT, data, operatorData, { gasLimit: 2500000 }
          )
          await expect(tx).to.changeTokenBalance(CONTRACT, recipientContract, AMOUNT)
          await expect(tx)
            .to.emit(CONTRACT, 'Transfer')
            .withArgs(ZERO_ADDRESS, recipientContract.target, AMOUNT)
            .and.to.emit(CONTRACT, 'Minted')
            .withArgs(OWNER.address, recipientContract.target, AMOUNT, data, operatorData)
        })

      // eslint-disable-next-line max-len
      it('`mint()` w/ `userData` should mint tokens, emit correct events & not go OOG when receiver returnbombs reverting',
        async () => {
          const data = '0xdead'
          const operatorData = '0xb33f'
          const recipientContract = await ethers
            .getContractFactory('contracts/test-contracts/PReceiver.sol:PReceiverRevertingReturnBombingReverting')
            .then(_factory => _factory.deploy())

          // the revert in receiveUserData consumes ~2M gas, thus provide the tx enough gas
          // to cover receiveUserData execution but not for copying bytes into caller context
          const tx = CONTRACT['mint(address,uint256,bytes,bytes)'](
            recipientContract.target, AMOUNT, data, operatorData, { gasLimit: 2500000 }
          )
          await expect(tx).to.changeTokenBalance(CONTRACT, recipientContract, AMOUNT)
          await expect(tx).to.emit(CONTRACT, 'Transfer')
            .withArgs(ZERO_ADDRESS, recipientContract.target, AMOUNT)
            .and.to.emit(CONTRACT, 'Minted')
            .withArgs(OWNER.address, recipientContract.target, AMOUNT, data, operatorData)
            .and.to.emit(CONTRACT, 'ReceiveUserDataFailed')
        })

      // eslint-disable-next-line max-len
      it('`mint()` w/ `userData` should mint tokens, emit correct events & not revert despite `receiveUserData` hook reverting',
        async () => {
          const data = '0xdead'
          const operatorData = '0xb33f'
          const recipientContract = await ethers
            .getContractFactory('contracts/test-contracts/PReceiver.sol:PReceiverReverting')
            .then(_factory => upgrades.deployProxy(_factory))

          const tx = CONTRACT['mint(address,uint256,bytes,bytes)'](recipientContract.target, AMOUNT, data, operatorData)
          await expect(tx).to.changeTokenBalance(CONTRACT, recipientContract, AMOUNT)
          await expect(tx).to.emit(CONTRACT, 'Transfer')
            .withArgs(ZERO_ADDRESS, recipientContract.target, AMOUNT)
            .and.to.emit(CONTRACT, 'Minted')
            .withArgs(OWNER.address, recipientContract.target, AMOUNT, data, operatorData)
            .and.to.emit(CONTRACT, 'ReceiveUserDataFailed')
        })

      it('Should revert when minting tokens with the contract address as the recipient', async () => {
        const recipient = CONTRACT.target
        try {
          await CONTRACT['mint(address,uint256)'](recipient, AMOUNT)
          assert.fail('Should not succeed!')
        } catch (_err) {
          const expectedErr = 'Recipient cannot be the token contract address!'
          assert(_err.message.includes(expectedErr))
        }
      })
    })

    describe('Redeem Tests', () => {
      it('`redeem()` function should burn tokens & emit correct events', async () => {
        const redeemAmount = 666
        const redeemer = OTHERS[3]
        const operator = redeemer.address
        const recipientBalanceBefore = await getTokenBalance(redeemer.address, CONTRACT)
        expect(recipientBalanceBefore).to.be.eq(0)
        await mintTokensToAccounts(CONTRACT, [ OWNER, ...OTHERS ], AMOUNT, OWNER)
        const recipientBalanceAfter = await getTokenBalance(redeemer.address, CONTRACT)
        expect(recipientBalanceAfter).to.be.eq(AMOUNT)
        const tx = CONTRACT.connect(redeemer)['redeem(uint256,string,bytes4)'](
          redeemAmount,
          ASSET_RECIPIENT,
          DESTINATION_CHAIN_ID,
        )
        await expect(tx).to.changeTokenBalance(CONTRACT, redeemer, -redeemAmount)
        await expect(tx).to.emit(CONTRACT, 'Redeem')
          .withArgs(redeemer.address, redeemAmount, ASSET_RECIPIENT, '0x', ORIGIN_CHAIN_ID, DESTINATION_CHAIN_ID)
          .and.to.emit(CONTRACT, 'Transfer')
          .withArgs(redeemer.address, ZERO_ADDRESS, redeemAmount)
          .and.to.emit(CONTRACT, 'Burned')
          .withArgs(redeemer.address, operator, redeemAmount, EMPTY_DATA, EMPTY_DATA)
      })

      it('Should get redeem fxn call data correctly', () => {
        const redeemAddress = '33L5hhKLhcNqN7oHfeW3evYXkr9VxyBRRi'
        const result = new ethers
          .Interface(CONTRACT.interface.fragments)
          .encodeFunctionData('redeem(uint256,string,bytes4)', [ AMOUNT, redeemAddress, DESTINATION_CHAIN_ID ])
        /* eslint-disable-next-line max-len */
        const expectedResult = '0xcd61f0b60000000000000000000000000000000000000000000000000000000000000539000000000000000000000000000000000000000000000000000000000000006000f3436800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002233334c3568684b4c68634e714e376f4866655733657659586b723956787942525269000000000000000000000000000000000000000000000000000000000000'
        assert.strictEqual(result, expectedResult)
      })
    })

    describe('Contract Upgrades Tests', () => {
      const UPGRADED_CONTRACT_PATH = _useGSN
        ? 'contracts/test-contracts/pTokenDummyUpgradeWithGSN.sol:PTokenDummyUpgradeWithGSN'
        : 'contracts/test-contracts/pTokenDummyUpgradeWithoutGSN.sol:PTokenDummyUpgradeWithoutGSN'
      const NEW_FXN_NAME = 'theMeaningOfLife'
      const getUpgradedContract = _address =>
        ethers.getContractFactory(UPGRADED_CONTRACT_PATH).then(_factory => upgrades.upgradeProxy(_address, _factory))

      it('Should upgrade contract', async () => {
        expect(CONTRACT.interface.getFunction(NEW_FXN_NAME)).to.be.null
        const upgradedContract = await getUpgradedContract(CONTRACT.target)
        expect(upgradedContract.interface.getFunction(NEW_FXN_NAME)).to.not.be.null
        const expectedResult = 42
        const result = await upgradedContract[NEW_FXN_NAME]()
        expect(result).to.be.eq(expectedResult)
      })

      it('User balance should remain after contract upgrade', async () => {
        const recipient = OTHERS[7].address
        const recipientBalanceBefore = await getTokenBalance(recipient, CONTRACT)
        await CONTRACT['mint(address,uint256)'](recipient, AMOUNT)
        const recipientBalanceAfter = await getTokenBalance(recipient, CONTRACT)
        expect(recipientBalanceBefore).to.be.eq(0)
        expect(recipientBalanceAfter).to.be.eq(AMOUNT)
        const upgradedContract = await getUpgradedContract(CONTRACT.target)
        const recipientBalanceAfterUpgrade = await getTokenBalance(recipient, upgradedContract)
        expect(recipientBalanceAfterUpgrade).to.be.eq(AMOUNT)
      })
    })

    describe('Change Origin ID Tests', () => {
      it('Owner can change origin ID', async () => {
        const newOriginChainId = '0xc0ffee00'
        assert.strictEqual(await CONTRACT.ORIGIN_CHAIN_ID(), ORIGIN_CHAIN_ID)
        await CONTRACT.changeOriginChainId(newOriginChainId)
        assert.strictEqual(await CONTRACT.ORIGIN_CHAIN_ID(), newOriginChainId)
      })

      it('Non owner cannot change origin ID', async () => {
        const newOriginChainId = '0xc0ffee00'
        assert.strictEqual(await CONTRACT.ORIGIN_CHAIN_ID(), ORIGIN_CHAIN_ID)
        try {
          await CONTRACT.connect(NON_OWNER).changeOriginChainId(newOriginChainId)
        } catch (_err) {
          const expectedErr = 'Caller is not an admin'
          assert(_err.message.includes(expectedErr))
        }
      })
    })
  })
)
