// Copyright 2015-2017 Parity Technologies (UK) Ltd.
// This file is part of Parity.

// Parity is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Parity is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Parity.  If not, see <http://www.gnu.org/licenses/>.

import { action, observable } from 'mobx';

export default class Store {
  @observable blocks = {};
  @observable sortedHashes = [];
  @observable transactions = {};

  constructor (api) {
    this._api = api;
    this._subscriptionId = 0;
    this._pendingHashes = [];

    this.containsAll = (arr1, arr2) => arr2.every(arr2Item => arr1.includes(arr2Item));
    this.sameMembers = (arr1, arr2) => this.containsAll(arr1, arr2) && this.containsAll(arr2, arr1);
  }

  @action addBlocks = (blocks) => {
    this.blocks = Object.assign({}, this.blocks, blocks);
  }

  @action addHash = (hash) => {
    if (!this.sortedHashes.includes(hash)) {
      this.sortedHashes.push(hash);
      this.sortHashes();
    }
  }

  @action removeHash = (hashes) => {
    this.sortedHashes = hashes;
    this.sortHashes();
  }

  sameHashList = (transactions) => {
    return this.sameMembers(this.sortedHashes, transactions);
  }

  sortHashes = () => {
    this.sortedHashes = this.sortedHashes.sort((hashA, hashB) => {
      const bnA = this.transactions[hashA].blockNumber;
      const bnB = this.transactions[hashB].blockNumber;

      if (bnB.eq(0)) {
        return bnB.eq(bnA) ? 0 : 1;
      } else if (bnA.eq(0)) {
        return -1;
      }

      return bnB.comparedTo(bnA);
    });
  }

  loadTransactions (_txhashes) {
    const { eth } = this._api;

    // Ignore special cases and if the contents of _txhashes && this.sortedHashes are the same
    if (Array.isArray(_txhashes) || this.sameHashList(_txhashes)) {
      return;
    }
    // If there was a hash removed:
    if (_txhashes.length < this.sortedHashes.length) {
      this.removeHash(_txhashes);
      return;
    }

    _txhashes
      .map((txhash) => {
        eth.getTransactionByHash(txhash)
          .then((tx) => {
            this.transactions[txhash] = tx;
            // If the tx has a blockHash, let's get the blockNumber, otherwise it's ready to be added
            if (tx.blockHash) {
              eth.getBlockByNumber(tx.blockNumber)
                .then((block) => {
                  this.blocks[tx.blockNumber] = block;
                  this.addHash(txhash);
                });
            } else {
              this.addHash(txhash);
            }
          });
      });
  }
}
