import React, { Component } from 'react'
import { Button } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import Block from './Block'

const { ROOT_NODE_ADDRESS } = require('../../config')

class Blocks extends Component {
  constructor(props) {
    super(props)
    this.state = { blocks: [], paginatedId: 1, blocksLength: 0 }
  }

  componentDidMount() {
    fetch(`${ROOT_NODE_ADDRESS}/api/blocks/length`)
      .then(response => response.json())
      .then(json => {
        console.log(`retrieved json: ${JSON.stringify(json)}`)

        this.setState({ blocksLength: json })
        const { paginatedId } = this.state
        this.fetchPaginatedBlocks(paginatedId)()
      })
  }

  fetchPaginatedBlocks = paginatedId => () => {
    fetch(`${ROOT_NODE_ADDRESS}/api/blocks/${paginatedId}`)
      .then(response => response.json())
      .then(json => this.setState({ blocks: json }))
  }

  render() {
    const { blocksLength, blocks } = this.state
    return (
      <div>
        <div><Link to="/">Home</Link></div>
        <h3>Blocks</h3>
        <div>
          {
            [...Array(Math.ceil(blocksLength / 5)).keys()].map(key => {
              const paginatedId = key + 1

              return (
                <span key={key} onClick={this.fetchPaginatedBlocks(paginatedId)}>
                  <Button bssize="small" bsstyle="danger">
                    {paginatedId}
                  </Button>{' '}
                </span>
              )
            })
          }
        </div>
        {
          blocks.map(block => (
            <Block key={block.hash} block={block} />
          ))
        }
      </div>
    )
  }
}

export default Blocks
