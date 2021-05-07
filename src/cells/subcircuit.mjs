"use strict";

import * as joint from 'jointjs';
import _ from 'lodash';
import { Box, BoxView } from './base';
import { IO, Input, Output } from './io';
import * as help from '../help';

// Subcircuit model -- embeds a circuit graph in an element
export const Subcircuit = Box.define('Subcircuit', {
    /* default properties */
    propagation: 0,
    warning: false,

    attrs: {
        wrapper: {
            refWidth: 1, refHeight: 1,
            stroke: 'red', strokeWidth: 10
        },
        type: {
            refX: .5, refY: -10,
            textAnchor: 'middle', textVerticalAnchor: 'middle'
        }
    }
}, {
    initialize() {
        this.bindAttrToProp('text.type/text', 'celltype');
        
        const graph = this.get('graph');
        console.assert(graph instanceof joint.dia.Graph);
        graph.set('subcircuit', this);
        const IOs = graph.getCells()
            .filter((cell) => cell instanceof IO);
        const inputs = IOs.filter((cell) => cell instanceof Input);
        const outputs = IOs.filter((cell) => cell instanceof Output);
        function sortfun(x, y) {
            if (x.has('order') || y.has('order'))
                return x.get('order') - y.get('order');
            return x.get('net').localeCompare(y.get('net'));
        }
        inputs.sort(sortfun);
        outputs.sort(sortfun);
        const vcount = Math.max(inputs.length, outputs.length);
        const size = { width: 80, height: vcount*16+8 };
        const ports = [], iomap = {}, inputSignals = {}, outputSignals = {};
        for (const [num, io] of inputs.entries()) {
            ports.push({ id: io.get('net'), group: 'in', dir: 'in', bits: io.get('bits'), labelled: true });
            inputSignals[io.get('net')] = io.get('outputSignals').out;
        }
        for (const [num, io] of outputs.entries()) {
            ports.push({ id: io.get('net'), group: 'out', dir: 'out', bits: io.get('bits'), labelled: true });
            outputSignals[io.get('net')] = io.get('inputSignals').in;
        }
        for (const io of IOs) {
            iomap[io.get('net')] = io.get('id');
        }
        this.set('size', size);
        this.set('circuitIOmap', iomap);
        this.set('inputSignals', inputSignals);
        this.set('outputSignals', outputSignals);
        this.get('ports').items = ports;
        this.set('warning', graph._warnings > 0);
        
        Box.prototype.initialize.apply(this, arguments);
    },
    _setInput(sig, port) {
        Box.prototype._setInput.apply(this, arguments);
        const iomap = this.get('circuitIOmap');
        const input = this.get('graph').getCell(iomap[port]);
        console.assert(input.isInput);
        input._setInput(sig);
    },
    _setOutput(sig, port) {
        const signals = _.clone(this.get('outputSignals'));
        signals[port] = sig;
        this.set('outputSignals', signals);
    },
    //add offset of 10pt to account for the top label at layout time
    getLayoutSize() {
        const size = this.size();
        size.height += 10;
        return size;
    },
    setLayoutPosition(position) {
        this.set('position', {
            x: position.x - position.width / 2,
            y: position.y - position.height / 2 + 10
        });
    },
    markup: [{
            tagName: 'rect',
            selector: 'wrapper'
        }
    ].concat(Box.prototype.markup, [{
            tagName: 'text',
            className: 'type',
            selector: 'type'
        }
    ], Box.prototype.markupZoom),
    _gateParams: Box.prototype._gateParams.concat(['celltype']),
    _unsupportedPropChanges: Box.prototype._unsupportedPropChanges.concat(['celltype'])
});

export const SubcircuitView = BoxView.extend({
    attrs: _.merge({}, BoxView.prototype.attrs, {
        warning: {
            warn: { wrapper: { 'stroke-opacity': '0.5' } },
            none: { wrapper: { 'stroke-opacity': '0' } }
        }
    }),
    _autoResizeBox: true,
    presentationAttributes: BoxView.addPresentationAttributes({
        warning: 'WARNING'
    }),
    confirmUpdate(flags) {
        BoxView.prototype.confirmUpdate.apply(this, arguments);
        if (this.hasFlag(flags, 'WARNING')) {
            this._updateWarning();
        }
    },
    _updateWarning() {
        const warning = this.model.get('warning');
        const attrs = this.attrs.warning[
            warning ? 'warn' : 'none'
        ];
        this._applyAttrs(attrs);
    },
    update() {
        BoxView.prototype.update.apply(this, arguments);
        this._updateWarning();
    },
    events: {
        "click foreignObject.tooltip": "stopprop",
        "mousedown foreignObject.tooltip": "stopprop",
        "click a.zoom": "zoomInCircuit"
    },
    zoomInCircuit(evt) {
        evt.stopPropagation();
        this.paper.trigger('open:subcircuit', this.model);
        return false;
    }
});

