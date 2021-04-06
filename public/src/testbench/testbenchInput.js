import CircuitElement from '../circuitElement';
import simulationArea from '../simulationArea';
import { correctWidth, lineTo, moveTo, fillText } from '../canvasApi';
import Node, { findNode, connectWireLess } from '../node';
import plotArea from '../plotArea';
import { testFinishedCallback } from '../ux';


/**
 * TestBench Input has a node for it's clock input.
 * this.testData - the data of all test cases.
 * Every testbench has a uniq identifier.
 * @class
 * @extends CircuitElement
 * @param {number} x - the x coord of TB
 * @param {number} y - the y coord of TB
 * @param {Scope=} scope - the circuit on which TB is drawn
 * @param {string} dir - direction
 * @param {string} identifier - id to identify tests
 * @param {JSON=} testData - input, output and number of tests
 * @category testbench
 */
export default class TB_Input extends CircuitElement {
    constructor(x, y, scope = globalScope, dir = 'RIGHT', identifier, testData) {
        super(x, y, scope, dir, 1);
        this.objectType = 'TB_Input';
        this.scope.TB_Input.push(this);
        this.setIdentifier(identifier || 'Test1');
        this.testData = testData || { type: "comb", sets: [{ inputs: [], outputs: [], n: 0 }] };
        this.clockInp = new Node(0, 20, 0, this, 1);
        this.outputs = [];
        this.running = false; // if tests are undergo
        this.iteration = 0;
        this.set = 0;
        this.outputList = [];
        this.setup();
        this.lastTestResult = "";
        this.runningContext = {runOn: "simulator"};
    }

    /**
     * @memberof TB_Input
     * Takes iput when double clicked. For help on generation of input refer to TB_Input.helplink
     */
    dblclick() {
        this.testData = JSON.parse(prompt('Enter TestBench Json'));
        this.setup();
    }

    setDimensions() {
        this.leftDimensionX = 0;
        this.rightDimensionX = 120;

        this.upDimensionY = 0;
        this.downDimensionY = 40 + this.testData.sets[0].inputs.length * 20;
    }

    bindIO() {

        for(let i = 0; i < this.testData.sets[0].inputs.length; i++){
            for(let inp of globalScope.Input){
                if(this.testData.sets[0].inputs[i].label === inp.label){
                    this.outputList.push(inp);
                    console.log(inp.label + " paired");
                }
            }
        }

        for(let inp of this.scope.Input){
            if(inp.label === "TBreset"){
                console.log("reset paired");
                this.resetInp = inp;
            }
        }
        for(let clk of globalScope.Clock){
            if("CLOCK" === clk.label){
                console.log("clock paired");
                this.clockInp.connectWireLess(clk.nodeList[0]);
                break;
            }
        }

        if(this.outputList.length != this.testData.sets[0].inputs.length){
            alert("All inputs/outputs not present in the project used for testing");
        }
    }

    /**
     * @memberof TB_Input
     * setups the Test by parsing through the testbench data.
     */
    setup() {
        this.iteration = 0;
        this.running = false;
        this.nodeList.clean(this.clockInp);
        this.deleteNodes();
        this.nodeList = [];
        this.nodeList.push(this.clockInp);
        this.testData = this.testData || { type: "comb", sets: [{ inputs: [], outputs: [], n: 0 }] } //{ inputs: [], outputs: [], n: 0 };
        // this.clockInp = new Node(0,20, 0,this,1);
        // if(this.testData.type === "comb"){
        //     this.testData = this.testData.sets[0];
        // }
        this.setDimensions();

        this.prevClockState = 0;
        this.outputs = [];
        this.outputList = [];

        if(true){
            // var oup = 0;
            // for (; oup < this.testData.sets[0].inputs.length; oup++) {
            //     this.outputs.push(new Node(this.rightDimensionX, 30 + oup * 20, 1, this, this.testData.sets[0].inputs[oup].bitWidth, this.testData.sets[0].inputs[oup].label));
            // }
            this.bindIO();

            for (var i = 0; i < this.scope.TB_Output.length; i++) {
                if (this.scope.TB_Output[i].identifier == this.identifier) { this.scope.TB_Output[i].setup(); }
            }
            // this.resetInp = new Node(this.rightDimensionX, 30 + oup * 20, 1, this, 1, "reset");
            // this.outputs.push(this.resetInp);
            // this.resetInp.value = 0;
            // simulationArea.simulationQueue.add(this.resetInp);
        }
    }

    /**
     * @memberof TB_Input
     * toggles state by simply negating this.running so that test cases stop
     */
    toggleState() {
        this.running = !this.running;
        this.prevClockState = 0;
    }

    /**
     * @memberof TB_Input
     * function to run from test case 0 again
     */
    resetIterations() {
        this.iteration = 0;
        this.prevClockState = 0;
        this.set = 0;
    }

    /**
     * @memberof TB_Input
     * function to resolve the testbench input adds
     */
    resolve() {
        console.log("resolving testbench input");
        if(this.testData.type === "comb"){
            if (this.clockInp.value != this.prevClockState) {
                this.prevClockState = this.clockInp.value;
                if (this.clockInp.value == 1 && this.running) {
                    if (this.iteration < this.testData.sets[0].n) {
                        this.iteration++;
                    } else {
                        this.running = false;
                        testFinishedCallback(this.lastTestResult, this.runningContext);

                    }
                }
            }
            if (this.running && this.iteration) {
                for (var i = 0; i < this.testData.sets[0].inputs.length; i++) {
                    this.outputList[i].state = parseInt(this.testData.sets[0].inputs[i].values[this.iteration - 1], 2);
                    simulationArea.simulationQueue.add(this.outputList[i]);
                }
            }
        }
        else if(this.testData.type === "seq"){
            if (this.clockInp.value != this.prevClockState) {
                this.prevClockState = this.clockInp.value;
                if (this.clockInp.value == 1 && this.running) {
                    if(this.resetInp.state === 1){
                        this.resetInp.state = 0;
                    }
                    if(this.set < this.testData.sets.length){
                        if (this.iteration < this.testData.sets[this.set].n) {
                            this.iteration++;
                        } else {
                            this.set ++;
                            this.iteration = 0;
                            this.resetInp.state = 1;
                        }
                    }
                    else{
                        this.running = false;
                        testFinishedCallback(this.lastTestResult, this.runningContext);
                    }
                }
            }
            if (this.running && this.iteration) {
                for (var i = 0; i < this.testData.sets[0].inputs.length; i++) {
                    this.outputList[i].state = parseInt(this.testData.sets[this.set].inputs[i].values[this.iteration - 1], 2);
                    simulationArea.simulationQueue.add(this.outputList[i]);
                }
            }
        }
    }

    /**
     * @memberof TB_Input
     * was a function to plot values incase any flag used as output to this element
     */
    setPlotValue() {
        return;
        var time = plotArea.stopWatch.ElapsedMilliseconds;
        if (this.plotValues.length && this.plotValues[this.plotValues.length - 1][0] == time) { this.plotValues.pop(); }

        if (this.plotValues.length == 0) {
            this.plotValues.push([time, this.inp1.value]);
            return;
        }

        if (this.plotValues[this.plotValues.length - 1][1] == this.inp1.value) { return; }
        this.plotValues.push([time, this.inp1.value]);
    }

    customSave() {
        var data = {
            constructorParamaters: [this.direction, this.identifier, this.testData],
            nodes: {
                outputs: this.outputList.map(findNode),
                clockInp: findNode(this.clockInp),
            },
        };
        return data;
    }

    /**
     * This function is used to set a uniq identifier to every testbench
     * @memberof TB_Input
     */
    setIdentifier(id = '') {
        if (id.length == 0 || id == this.identifier) return;


        for (var i = 0; i < this.scope.TB_Output.length; i++) {
            this.scope.TB_Output[i].checkPairing();
        }


        for (var i = 0; i < this.scope.TB_Output.length; i++) {
            if (this.scope.TB_Output[i].identifier == this.identifier) { this.scope.TB_Output[i].identifier = id; }
        }

        this.identifier = id;

        this.checkPaired();
    }

    /**
     * Check if there is a output tester paired with input TB.
     * @memberof TB_Input
     */
    checkPaired() {
        for (var i = 0; i < this.scope.TB_Output.length; i++) {
            if (this.scope.TB_Output[i].identifier == this.identifier) { this.scope.TB_Output[i].checkPairing(); }
        }
    }

    delete() {
        super.delete();
        this.checkPaired();
    }

    customDraw() {
        var ctx = simulationArea.context;
        ctx.beginPath();
        ctx.strokeStyle = 'grey';
        ctx.fillStyle = '#fcfcfc';
        ctx.lineWidth = correctWidth(1);
        var xx = this.x;
        var yy = this.y;

        var xRotate = 0;
        var yRotate = 0;
        if (this.direction == 'LEFT') {
            xRotate = 0;
            yRotate = 0;
        } else if (this.direction == 'RIGHT') {
            xRotate = 120 - this.xSize;
            yRotate = 0;
        } else if (this.direction == 'UP') {
            xRotate = 60 - this.xSize / 2;
            yRotate = -20;
        } else {
            xRotate = 60 - this.xSize / 2;
            yRotate = 20;
        }

        ctx.beginPath();
        ctx.textAlign = 'center';
        ctx.fillStyle = 'black';
        fillText(ctx, `${this.identifier} [INPUT]`, xx + this.rightDimensionX / 2, yy + 14, 10);

        fillText(ctx, ['Not Running', 'Running'][+this.running], xx + this.rightDimensionX / 2, yy + 14 + 10 + 20 * this.testData.sets[0].inputs.length, 10);

        fillText(ctx, `Case: ${this.iteration}`, xx + this.rightDimensionX / 2, yy + 14 + 20 + 20 * this.testData.sets[0].inputs.length, 10);
        // fillText(ctx, "Case: "+this.iteration, xx  , yy + 20+14, 10);
        ctx.fill();


        ctx.font = '30px Raleway';
        ctx.textAlign = 'right';
        ctx.fillStyle = 'blue';
        ctx.beginPath();
        for (var i = 0; i < this.testData.sets[0].inputs.length; i++) {
            // ctx.beginPath();
            fillText(ctx, this.testData.sets[0].inputs[i].label, this.rightDimensionX - 5 + xx, 30 + i * 20 + yy + 4, 10);
        }

        ctx.fill();
        if (this.running && this.iteration) {
            ctx.font = '30px Raleway';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'blue';
            ctx.beginPath();
            for (var i = 0; i < this.testData.sets[0].inputs.length; i++) {
                fillText(ctx, this.testData.sets[this.set].inputs[i].values[this.iteration - 1], 5 + xx, 30 + i * 20 + yy + 4, 10);
            }

            ctx.fill();
        }

        ctx.beginPath();
        ctx.strokeStyle = ('rgba(0,0,0,1)');
        ctx.lineWidth = correctWidth(3);
        var xx = this.x;
        var yy = this.y;
        // rect(ctx, xx - 20, yy - 20, 40, 40);
        moveTo(ctx, 0, 15, xx, yy, this.direction);
        lineTo(ctx, 5, 20, xx, yy, this.direction);
        lineTo(ctx, 0, 25, xx, yy, this.direction);

        ctx.stroke();
    }
}

TB_Input.prototype.tooltipText = 'Test Bench Input Selected';

/**
 * @memberof TB_Input
 * different algo for drawing center elements
 * @category testbench
 */
TB_Input.prototype.centerElement = true;

TB_Input.prototype.helplink = 'https://docs.circuitverse.org/#/testbench';

TB_Input.prototype.mutableProperties = {
    identifier: {
        name: 'TestBench Name:',
        type: 'text',
        maxlength: '10',
        func: 'setIdentifier',
    },
    iteration: {
        name: 'Reset Iterations',
        type: 'button',
        func: 'resetIterations',
    },
    toggleState: {
        name: 'Toggle State',
        type: 'button',
        func: 'toggleState',
    },
};
TB_Input.prototype.objectType = 'TB_Input';
