const bodyParser = require('body-parser')
const express = require('express')
const request = require('request')
const path = require('path')
const cors = require('cors')

const Blockchain = require('./blockchain')
const PubSub = require('./app/pubsub')
const Transaction = require('./wallet/transaction')
const TransactionPool = require('./wallet/transaction-pool')
const Wallet = require('./wallet')
const TransactionMiner = require('./app/transaction-miner')

const { DEFAULT_PORT, ROOT_NODE_ADDRESS, } = require('../config')

const app = express()
const blockchain = new Blockchain()
const transactionPool = new TransactionPool()
const wallet = new Wallet()

const pubsub = new PubSub({ blockchain, transactionPool, wallet, })

const transactionMiner = new TransactionMiner({
  blockchain, transactionPool, wallet, pubsub,
})

app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, 'client/dist')))

// enable CORS
app.use(cors())

app.get('/api/blocks', (req, res) => {
  res.json(blockchain.chain)
})

app.get('/api/blocks/length', (req, res) => {
  res.json(blockchain.chain.length)
})

app.get('/api/blocks/:id', (req, res) => {
  const { id, } = req.params
  const { length, } = blockchain.chain

  const blocksReversed = blockchain.chain.slice().reverse()

  let startIndex = (id - 1) * 5
  let endIndex = id * 5

  startIndex = startIndex < length ? startIndex : length
  endIndex = endIndex < length ? endIndex : length

  res.json(blocksReversed.slice(startIndex, endIndex))
})

app.post('/api/mine', (req, res) => {
  const { data, } = req.body

  blockchain.addBlock({ data, })

  pubsub.broadcastChain()

  res.redirect('/api/blocks')
})

app.post('/api/transact', (req, res) => {
  const { amount, recipient, } = req.body

  let transaction = transactionPool
    .existingTransaction({ inputAddress: wallet.publicKey, })
  try {
    if (transaction) {
      const transactionObj = Object.assign(new Transaction({
        senderWallet: wallet, recipient, amount, outputMap: {}, input: {},
      }), transaction)

      transactionObj.update({ senderWallet: wallet, recipient, amount, })
    } else {
      transaction = wallet.createTransaction({
        recipient,
        amount,
        chain: blockchain.chain,
      })
    }
  } catch (error) {
    return res.status(400).json({ type: 'error', message: error.message, })
  }

  transactionPool.setTransaction(transaction)

  pubsub.broadcastTransaction(transaction)

  res.json({ type: 'success', transaction, })
})

app.get('/api/transaction-pool-map', (req, res) => {
  res.json(transactionPool.transactionMap)
})

app.get('/api/mine-transactions', (req, res) => {
  transactionMiner.mineTransactions()

  res.redirect('/api/blocks')
})

app.get('/api/wallet-info', (req, res) => {
  const address = wallet.publicKey

  res.json({
    address,
    balance: Wallet.calculateBalance({ chain: blockchain.chain, address, }),
  })
})

app.get('/api/known-addresses', (req, res) => {
  const addressMap = {}

  for (const block of blockchain.chain) { // eslint-disable-line no-restricted-syntax
    for (const transaction of block.data) { // eslint-disable-line no-restricted-syntax
      const recipient = Object.keys(transaction.outputMap)

      recipient.forEach(recipient => addressMap[recipient] = recipient) // eslint-disable-line no-return-assign
    }
  }

  res.json(Object.keys(addressMap))
})

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'))
})

const syncWithRootState = () => {
  request({ url: `${ROOT_NODE_ADDRESS}/api/blocks`, }, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      const rootChain = JSON.parse(body)

      console.log('replace chain on a sync with', rootChain) // eslint-disable-line no-console
      blockchain.replaceChain(rootChain)
    }
  })

  request({ url: `${ROOT_NODE_ADDRESS}/api/transaction-pool-map`, }, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      const rootTransactionPoolMap = JSON.parse(body)

      console.log('replace transaction pool map on a sync with', rootTransactionPoolMap) // eslint-disable-line no-console
      transactionPool.setMap(rootTransactionPoolMap)
    }
  })
}

app.listen(DEFAULT_PORT, () => {
  console.log(`listening at localhost:${DEFAULT_PORT}`) // eslint-disable-line no-console

  syncWithRootState()
})