'use strict'

const assert = require('assert')

const exists = require('101/exists')
const SpanData = require('@google/cloud-trace/lib/span-data.js')
const TraceLabels = require('@google/cloud-trace/lib/trace-labels.js')
const shimmer = require('shimmer')

const agent = require('./agent.js')

module.exports = extendSpanData

function extendSpanData () {
  // Existing SpanData public methods
  // - createChildSpanData
  // - addLabel
  // - close

  shimmer.wrap(SpanData.prototype, 'addLabel', function (addLabel) {
    return function () {
      if (this.span.endTime) {
        // don't allow addLabel after close..
        return
      }
      return addLabel.apply(this, arguments)
    }
  })

  shimmer.wrap(SpanData.prototype, 'close', function (close) {
    return function () {
      const config = this.agent.config()
      if (!config.enabled || (this.isRoot && ~config.ignoreUrls.indexOf(this.span.name.toLowerCase()))) {
        return
      }
      if (this.span.endTime) {
        // don't allow close twice..
        return
      }
      return close.apply(this, arguments)
    }
  })

  SpanData.prototype.toHeader = function () {
    return agent.generateTraceContext(this, this.agent.config().enabled)
  }

  SpanData.prototype.addStatusCode = function (statusCode) {
    assert(exists(statusCode), 'statusCode is required')
    return this.addLabel(TraceLabels.HTTP_RESPONSE_CODE_LABEL_KEY, this.statusCode)
  }

  SpanData.prototype.addLabels = function (labels) {
    const self = this
    labels = labels || {}
    Object.keys(labels).forEach(function (key) {
      const val = labels[key]
      self.addLabel(key, val)
    })
  }
}
