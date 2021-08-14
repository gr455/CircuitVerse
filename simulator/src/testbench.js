/**
 * This file contains all functions related the the testbench
 * Contains the the testbench engine and UI modules
 */

import { scheduleBackup } from './data/backupCircuit';
import { changeClockEnable } from './sequential';
import { play } from './engine';
import Scope from './circuit';
import { showMessage, escapeHtml } from './utils';

/**
 * @typedef {number} RunContext
 */
const CONTEXT = {
    CONTEXT_SIMULATOR: 0,
    CONTEXT_ASSIGNMENTS: 1,
};

const TESTBENCH_CREATOR_PATH = '/testbench';


// Do we have any other function to do this?
// Utility function. Converts decimal number to binary string
function dec2bin(dec) {
    return (dec >>> 0).toString(2);
}

/**
 * Class to store all data related to the testbench and functions to use it
 * @param {Object} data - Javascript object of the test data
 * @param {number=} currentGroup - Current group index in the test
 * @param {number=} currentCase - Current case index in the group
 */
export class TestbenchData {
    constructor(data, currentGroup = 0, currentCase = 0) {
        this.currentCase = currentCase;
        this.currentGroup = currentGroup;
        this.testData = data;
    }

    /**
     * Checks whether given case-group pair exists in the test
     */
    isCaseValid() {
        if(this.currentGroup >= this.data.groups.length || this.currentGroup < 0) return false;
        const caseCount = this.testData.groups[this.currentGroup].inputs[0].values.length;
        if(this.currentCase >= caseCount || this.currentCase < 0) return false;

        return true;
    }

    /**
     * Validate and set case and group in the test
     * @param {number} groupIndex - Group index to set
     * @param {number} caseIndex -  Case index to set
     */
    setCase(groupIndex, caseIndex) {
        const newCase = new TestbenchData(this.testData, groupIndex, caseIndex);
        if(newCase.isCaseValid()) {
            this.currentGroup = groupIndex;
            this.currentCase = caseIndex;
            return true;
        }

        return false;
    }

    /**
     * Validate and go to the next group.
     * Skips over empty groups
     */
    groupNext() {
        const newCase = new TestbenchData(this.testData, this.currentGroup, 0);
        const groupCount = newCase.testData.groups.length;
        let caseCount = newCase.testData.groups[newCase.currentGroup].inputs[0].values.length;

        while (caseCount === 0 || this.currentGroup === newCase.currentGroup) {
            newCase.currentGroup++;
            if (newCase.currentGroup >= groupCount) return false;
            caseCount = newCase.testData.groups[newCase.currentGroup].inputs[0].values.length; 
        }

        this.currentGroup = newCase.currentGroup;
        this.currentCase = newCase.currentCase;
        return true;

    }

    /**
     * Validate and go to the previous group.
     * Skips over empty groups
     */
    groupPrev() {
        const newCase = new TestbenchData(this.testData, this.currentGroup, 0);
        const groupCount = newCase.testData.groups.length;
        let caseCount = newCase.testData.groups[newCase.currentGroup].inputs[0].values.length;

        while (caseCount === 0 || this.currentGroup === newCase.currentGroup) {
            newCase.currentGroup--;
            if (newCase.currentGroup < 0) return false;
            caseCount = newCase.testData.groups[newCase.currentGroup].inputs[0].values.length; 
        }

        this.currentGroup = newCase.currentGroup;
        this.currentCase = newCase.currentCase;
        return true;
    }

    /**
     * Validate and go to the next case
     */
    caseNext() {
        const caseCount = this.testData.groups[this.currentGroup].inputs[0].values.length;
        if (this.currentCase >= caseCount - 1) return this.groupNext();
        this.currentCase++;
        return true;
    }

    /**
     * Validate and go to the previous case
     */
    casePrev() {
        if (this.currentCase <= 0) {
            if(!this.groupPrev()) return false;
            const caseCount = this.testData.groups[this.currentGroup].inputs[0].values.length;
            this.currentCase = caseCount - 1;
            return true;
        }

        this.currentCase--;
        return true;
    }

    /**
     * Finds and switches to the first non empty group to start the test from
     */
    goToFirstValidGroup() {
        const newCase = new TestbenchData(this.testData, 0, 0);
        const caseCount = newCase.testData.groups[this.currentGroup].inputs[0].values.length;

        // If the first group is not empty, do nothing
        if (caseCount > 0) return true;

        // Otherwise go next until non empty group
        const validExists = newCase.groupNext()

        // If all groups empty return false
        if (!validExists) return false;

        // else set case to the non empty group
        this.currentGroup = newCase.currentGroup;
        this.currentCase = newCase.currentCase;
        return true;

    }
}

/**
 * UI Function
 * Create prompt for the testbench UI when creator is opened
 */
function creatorOpenPrompt(creatorWindow) {
    scheduleBackup();
    const windowSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="white" class="bi bi-window" viewBox="0 0 16 16">
      <path d="M2.5 4a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm2-.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm1 .5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
      <path d="M2 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H2zm13 2v2H1V3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1zM2 14a1 1 0 0 1-1-1V6h14v7a1 1 0 0 1-1 1H2z"/>
    </svg>
    `;

    const s = `
    <div style="text-align: center;">
        <div style="margin: 20px;">
            ${windowSVG}
        </div>
        <p>A browser pop-up is opened to create the test</p>
        <p>Please save the test to open it here</p>
    </div>
    `;

    $('#setTestbenchData').dialog({
        resizable: false,
        width: 'auto',
        buttons: [
            {
                text: 'Close Pop-Up',
                click() {
                    $(this).dialog('close');
                    creatorWindow.close();
                }
            }
        ]
    });

    $('#setTestbenchData').empty();
    $('#setTestbenchData').append(s);
}

/**
 * Interface function to run testbench. Called by testbench prompt on simulator or assignments
 * @param {Object} data - Object containing Test Data
 * @param {RunContext=} runContext - Whether simulator or Assignment called this function
 * @param {Scope=} scope - the circuit
 */
export function runTestBench(data, scope = globalScope, runContext = CONTEXT.CONTEXT_SIMULATOR) {

    const isValid = validate(data, scope);
    if (!isValid.ok) {
        showMessage('Testbench: Add all the expected components');
    }

    if (runContext === CONTEXT.CONTEXT_SIMULATOR) {
        const tempTestbenchData = new TestbenchData(data);
        if (!tempTestbenchData.goToFirstValidGroup()) {
            showMessage('Testbench: The test is empty');
            return;
        }

        globalScope.testbenchData = tempTestbenchData;

        updateTestbenchUI();
        return
    }

    if(runContext === CONTEXT.CONTEXT_ASSIGNMENTS) {
        // Not implemented
        return;
    }

}

/**
 * Updates the TestBench UI on the simulator with the current test attached
 * If no test is attached then shows the 'No test attached' screen
 * Called by runTestBench() when test is set, also called by UX/setupPanelListeners()
 * whenever ux change requires this UI to update(such as clicking on a different circuit or
 * loading a saved circuit)
 */
export function updateTestbenchUI() {
    // Remove all listeners from buttons
    $('.tb-dialog-button').off('click');
    $('.tb-case-button').off('click');

    setupTestbenchUI();
    if (globalScope.testbenchData != undefined) {

        const testbenchData = globalScope.testbenchData;

        // Initialize the UI
        setUITableHeaders(testbenchData);

        // Add listeners to buttons
        $('.tb-case-button#prev-case-btn').on('click', buttonListenerFunctions.previousCaseButton);
        $('.tb-case-button#next-case-btn').on('click', buttonListenerFunctions.nextCaseButton);
        $('.tb-case-button#prev-group-btn').on('click', buttonListenerFunctions.previousGroupButton);
        $('.tb-case-button#next-group-btn').on('click', buttonListenerFunctions.nextGroupButton);
        $('.tb-dialog-button#change-test-btn').on('click', buttonListenerFunctions.changeTestButton);
        $('.tb-dialog-button#runall-btn').on('click', buttonListenerFunctions.runAllButton);
        $('.tb-dialog-button#edit-test-btn').on('click', buttonListenerFunctions.editTestButton);
        $('.tb-dialog-button#validate-btn').on('click', buttonListenerFunctions.validateButton);
        $('.tb-dialog-button#remove-test-btn').on('click', buttonListenerFunctions.removeTestButton);

    }

    // Add listener to attach test button
    $('.tb-dialog-button#attach-test-btn').on('click', buttonListenerFunctions.attachTestButton);
}

/**
 * Defines all the functions called as event listeners for buttons on the UI
 */
const buttonListenerFunctions = {

    previousCaseButton: () => {
        const isValid = validate(globalScope.testbenchData.testData, globalScope);
        if (!isValid.ok) {
            showMessage(`Testbench: ${isValid.message}`);
            return;
        }
        globalScope.testbenchData.casePrev();
        buttonListenerFunctions.computeCase();
    },

    nextCaseButton: () => {
        const isValid = validate(globalScope.testbenchData.testData, globalScope);
        if (!isValid.ok) {
            showMessage(`Testbench: ${isValid.message}`);
            return;
        }
        globalScope.testbenchData.caseNext();
        buttonListenerFunctions.computeCase();
    },

    previousGroupButton: () => {
        const isValid = validate(globalScope.testbenchData.testData, globalScope);
        if (!isValid.ok) {
            showMessage(`Testbench: ${isValid.message}`);
            return;
        }
        globalScope.testbenchData.groupPrev();
        buttonListenerFunctions.computeCase();
    },

    nextGroupButton: () => {
        const isValid = validate(globalScope.testbenchData.testData, globalScope);
        if (!isValid.ok) {
            showMessage(`Testbench: ${isValid.message}`);
            return;
        }
        globalScope.testbenchData.groupNext();
        buttonListenerFunctions.computeCase();
    },

    changeTestButton: () => {
        openCreator('create');
    },

    runAllButton: () => {
        const isValid = validate(globalScope.testbenchData.testData, globalScope);
        if (!isValid.ok) {
            showMessage(`Testbench: ${isValid.message}`);
            return;
        }
        const results = runAll(globalScope.testbenchData.testData, globalScope);
        const passed = results.summary.passed;
        const total = results.summary.total;
        const resultString = JSON.stringify(results.detailed);
        $('#runall-summary').text(`${passed} out of ${total}`);
        $('#runall-detailed-link').on('click', () => { openCreator('result', resultString) });
        $('.testbench-runall-label').css('display','table-cell');
        $('.testbench-runall-label').delay(5000).fadeOut('slow');
    },

    editTestButton: () => {
        const editDataString = JSON.stringify(globalScope.testbenchData.testData);
        openCreator('edit', editDataString);
    },

    validateButton: () => {
        const isValid = validate(globalScope.testbenchData.testData, globalScope);
        if(isValid.ok) showMessage("Testbench: Test is valid");
        else showMessage(`Testbench: ${isValid.message}`);
    },

    removeTestButton: () => {
        if (confirm("Are you sure you want to remove the test from the circuit?")) {
            globalScope.testbenchData = undefined;
            setupTestbenchUI();
        }
    },

    attachTestButton: () => {
        openCreator('create');
    },

    rerunTestButton: () => {
        buttonListenerFunctions.computeCase();
    },

    computeCase: () => {
        setUICurrentCase(globalScope.testbenchData);
        const result = runSingleTest(globalScope.testbenchData, globalScope);
        setUIResult(globalScope.testbenchData, result);
    }
};

/**
 * UI Function
 * Checks whether test is attached to the scope and switches UI accordingly
 */
export function setupTestbenchUI() {
    // Don't change UI if UI is minimized (because hide() and show() are recursive)
    if ($('.testbench-manual-panel .minimize').css('display') === 'none')
        return;

    if (globalScope.testbenchData === undefined) {
        $('.tb-test-not-null').hide();
        $('.tb-test-null').show();
        return;
    }

    $('.tb-test-null').hide();
    $('.tb-test-not-null').show();
}

/**
 * Run all the tests automatically. Called by runTestBench()
 * @param {Object} data - Object containing Test Data
 * @param {Scope=} scope - the circuit
 */
function runAll(data, scope) {
    // Stop the clocks
    // TestBench will now take over clock toggling
    changeClockEnable(false);

    const { inputs, outputs, reset } = bindIO(data, scope);
    let totalCases = 0;
    let passedCases = 0;
    for (const group of data.groups) {
        for (const output of group.outputs) output.results = [];
        for (let case_i = 0; case_i < group.n; case_i++) {
            totalCases++;
            // Set and propagate the inputs
            setInputValues(inputs, group, case_i, scope);
            // If sequential, trigger clock now
            if (data.type === 'seq') tickClock(scope);
            // Get output values
            const caseResult = getOutputValues(data, outputs);
            // Put the results in the data

            let casePassed = true; // Tracks if current case passed or failed
            for (const outName of caseResult.keys()) {
                // TODO: find() is not the best idea because of O(n)
                const output = group.outputs.find((dataOutput) => dataOutput.label === outName);
                output.results.push(caseResult.get(outName));

                if (output.values[case_i] !== caseResult.get(outName)) casePassed = false;
            }

            // If current case passed, then increment passedCases
            if(casePassed) passedCases++;
        }

        // If sequential, trigger reset at the end of group (set)
        if (data.type === 'seq') triggerReset(reset);
    }

    // Tests done, restart the clocks
    changeClockEnable(true);

    // Return results
    const results = {} 
    results.detailed = data;
    results.summary = { passed: passedCases, total: totalCases };
    // console.log(JSON.stringify(results.detailed));
    return results;
}

/**
 * Runs single test
 * @param {Object} data - Object containing Test Data
 * @param {number} groupIndex - Index of the group to be tested
 * @param {number} caseIndex - Index of the case inside the group
 * @param {Scope} scope - The circuit
 */
function runSingleTest(testbenchData, scope) {
    const data = testbenchData.testData;

    let result;
    if (data.type === 'comb') {
        result = runSingleCombinational(testbenchData, scope);
    } else if (data.type === 'seq') {
        result = runSingleSequential(testbenchData, scope);
    }

    return result;
}

/**
 * Runs single combinational test
 * @param {Object} data - Object containing Test Data
 * @param {number} groupIndex - Index of the group to be tested
 * @param {number} caseIndex - Index of the case inside the group
 * @param {Scope} scope - The circuit
 */
function runSingleCombinational(testbenchData, scope) {
    const data = testbenchData.testData;
    const groupIndex = testbenchData.currentGroup;
    const caseIndex = testbenchData.currentCase;

    const { inputs, outputs } = bindIO(data, scope);
    const group = data.groups[groupIndex];

    // Stop the clocks
    changeClockEnable(false);

    // Set input values according to the test
    setInputValues(inputs, group, caseIndex, scope);
    // Check output values
    const result = getOutputValues(data, outputs);
    // Restart the clocks
    changeClockEnable(true);
    return result;
}

/**
 * Runs single sequential test and all tests above it in the group
 * Used in MANUAL mode
 * @param {Object} data - Object containing Test Data
 * @param {number} groupIndex - Index of the group to be tested
 * @param {number} caseIndex - Index of the case inside the group
 * @param {Scope} scope - The circuit
 */
function runSingleSequential(testbenchData, scope) {
    const data = testbenchData.testData;
    const groupIndex = testbenchData.currentGroup;
    const caseIndex = testbenchData.currentCase;

    const { inputs, outputs, reset } = bindIO(data, scope);
    const group = data.groups[groupIndex];

    // Stop the clocks
    changeClockEnable(false);

    // Trigger reset
    triggerReset(reset, scope);

    // Run the test and tests above in the same group
    for (let case_i = 0; case_i <= caseIndex; case_i++) {
        setInputValues(inputs, group, case_i, scope);
        tickClock(scope);
    }

    const result = getOutputValues(data, outputs);

    // Restart the clocks
    changeClockEnable(true);

    return result;
}

/**
 * Set and propogate the input values according to the testcase.
 * Called by runSingle() and runAll()
 * @param {Object} inputs - Object with keys as input names and values as inputs
 * @param {Object} group - Test group
 * @param {number} caseIndex - Index of the case in the group
 * @param {Scope} scope - the circuit
 */
function setInputValues(inputs, group, caseIndex, scope) {
    for (const input of group.inputs) {
        inputs[input.label].state = parseInt(input.values[caseIndex], 2);
    }

    // Propagate inputs
    play(scope);
}

/**
 * Gets Output values as a Map with keys as output name and value as output state
 * @param {Object} outputs - Object with keys as output names and values as outputs
 */
function getOutputValues(data, outputs) {
    const values = new Map();
    for (const dataOutput of data.groups[0].outputs) {
        // Using node value because output state only changes on rendering
        const resultValue = outputs[dataOutput.label].nodeList[0].value;
        values.set(dataOutput.label, dec2bin(resultValue));
    }

    return values;
}

/**
 * Validate if all inputs and output elements are present with correct bitwidths
 * Called by runTestBench()
 * @param {Object} data - Object containing Test Data
 * @param {Scope} scope - the circuit
 */
function validate(data, scope) {
    if (!checkDistinctIdentifiersData(data)) return { ok: false, message: 'Duplicate identifiers in test data' };
    if (!checkDistinctIdentifiersScope(scope)) return { ok: false, message: 'Duplicate identifiers in circuit' };

    // Validate inputs and outputs
    const inputsValid = validateInputs(data, scope);
    const outputsValid = validateOutputs(data, scope);

    if (!inputsValid.ok) return inputsValid;
    if (!outputsValid.ok) return outputsValid;

    // Validate presence of reset if test is sequential
    if (data.type === 'seq') {
        const resetPresent = scope.Input.some((simulatorReset) => (
            simulatorReset.label === 'RST'
                && simulatorReset.bitWidth === 1
                && simulatorReset.objectType === 'Input'
        ));

        if (!(resetPresent)) return { ok: false, message: 'Reset(RST) not present in circuit' };
    }

    return { ok: true };
}

/**
 * Checks if all the labels in the test data are unique. Called by validate()
 * @param {Object} data - Object containing Test Data
 */
function checkDistinctIdentifiersData(data) {
    const inputIdentifiersData = data.groups[0].inputs.map((input) => input.label);
    const outputIdentifiersData = data.groups[0].outputs.map((output) => output.label);
    const identifiersData = inputIdentifiersData.concat(outputIdentifiersData);

    return (new Set(identifiersData)).size === identifiersData.length;
}

/**
 * Checks if all the input/output labels in the scope are unique. Called by validate()
 * TODO: Replace with identifiers
 * @param {Scope} scope - the circuit
 */
function checkDistinctIdentifiersScope(scope) {
    const inputIdentifiersScope = scope.Input.map((input) => input.label);
    const outputIdentifiersScope = scope.Output.map((output) => output.label);
    const identifiersScope = inputIdentifiersScope.concat(outputIdentifiersScope);

    return (new Set(identifiersScope)).size === identifiersScope.length;
}

/**
 * Validates presence and bitwidths of test inputs in the circuit.
 * Called by validate()
 * @param {Object} data - Object containing Test Data
 * @param {Scope} scope - the circuit
 */
function validateInputs(data, scope) {
    for (const dataInput of data.groups[0].inputs) {
        const matchInput = scope.Input.find((simulatorInput) => simulatorInput.label === dataInput.label);

        if (matchInput === undefined) {
            return {
                ok: false,
                message: `Input - ${dataInput.label} is not present in the circuit`,
            };
        }

        if (matchInput.bitWidth !== dataInput.bitWidth) {
            return {
                ok: false,
                message: `Input - ${dataInput.label} bitwidths don't match in circuit and test`,
            };
        }
    }

    return { ok: true };
}

/**
 * Validates presence and bitwidths of test outputs in the circuit.
 * Called by validate()
 * @param {Object} data - Object containing Test Data
 * @param {Scope} scope - the circuit
 */
function validateOutputs(data, scope) {
    for (const dataOutput of data.groups[0].outputs) {
        const matchOutput = scope.Output.find((simulatorOutput) => simulatorOutput.label === dataOutput.label);

        if (matchOutput === undefined) {
            return {
                ok: false,
                message: `Output - ${dataOutput.label} is not present in the circuit`,
            };
        }

        if (matchOutput.bitWidth !== dataOutput.bitWidth) {
            return {
                ok: false,
                message: `Output - ${dataOutput.label} bitwidths don't match in circuit and test`,
            };
        }
    }

    return { ok: true };
}

/**
 * Returns object of scope inputs and outputs keyed by their labels
 * @param {Object} data - Object containing Test Data
 * @param {Scope=} scope - the circuit
 */
function bindIO(data, scope) {
    const inputs = {};
    const outputs = {};
    let reset;
    for (const dataInput of data.groups[0].inputs) {
        inputs[dataInput.label] = scope.Input.find((simulatorInput) => simulatorInput.label === dataInput.label);
    }

    for (const dataOutput of data.groups[0].outputs) {
        outputs[dataOutput.label] = scope.Output.find((simulatorOutput) => simulatorOutput.label === dataOutput.label);
    }

    if (data.type === 'seq') {
        reset = scope.Input.find((simulatorOutput) => simulatorOutput.label === 'RST');
    }

    return { inputs, outputs, reset };
}

/**
 * Ticks clock recursively one full cycle (Only used in testbench context)
 * @param {Scope} scope - the circuit whose clock to be ticked
 */
function tickClock(scope) {
    scope.clockTick();
    play(scope);
    scope.clockTick();
    play(scope);
}

/**
 * Triggers reset (Only used in testbench context)
 * @param {Input} reset - reset pin to be triggered
 * @param {Scope} scope - the circuit
 */
function triggerReset(reset, scope) {
    reset.state = 1;
    play(scope);
    reset.state = 0;
    play(scope);
}

/**
 * UI Function
 * Sets IO labels and bitwidths on UI table
 * Called by simulatorRunTestbench()
 * @param {Object} data - Object containing the test data
 */
function setUITableHeaders(testbenchData) {
    const data = testbenchData.testData;
    const inputCount = data.groups[0].inputs.length;
    const outputCount = data.groups[0].outputs.length;

    $('#tb-manual-table-inputs-head').attr('colspan', inputCount);
    $('#tb-manual-table-outputs-head').attr('colspan', outputCount);

    $('.testbench-runall-label').css('display','none');

    $('.tb-data#data-title').children().eq(1).text(data.title || "Untitled");
    $('.tb-data#data-type').children().eq(1).text(data.type === "comb" ? "Combinational" : "Sequential");

    $('#tb-manual-table-labels').html('<th>LABELS</th>');
    $('#tb-manual-table-bitwidths').html('<td>Bitwidth</td>');
    for (const io of data.groups[0].inputs.concat(data.groups[0].outputs)) {
        const label = `<th>${escapeHtml(io.label)}</th>`;
        const bw = `<td>${escapeHtml(io.bitWidth.toString())}</td>`;
        $('#tb-manual-table-labels').append(label);
        $('#tb-manual-table-bitwidths').append(bw);
    }

    setUICurrentCase(testbenchData);
}

/**
 * UI Function
 * Set current test case data on the UI
 * @param {Object} data - Object containing the test data
 * @param {number} groupIndex - Index of the group of current case
 * @param {number} caseIndex - Index of the case within the group
 */
function setUICurrentCase(testbenchData) {
    const data = testbenchData.testData;
    const groupIndex = testbenchData.currentGroup;
    const caseIndex = testbenchData.currentCase;

    const currCaseElement = $('#tb-manual-table-current-case');
    currCaseElement.empty();
    currCaseElement.append('<td>Current Case</td>');
    $('#tb-manual-table-test-result').empty();
    $('#tb-manual-table-test-result').append('<td>Result</td>');
    for (const input of data.groups[groupIndex].inputs) {
        currCaseElement.append(`<td>${escapeHtml(input.values[caseIndex])}</td>`);
    }

    for (const output of data.groups[groupIndex].outputs) {
        currCaseElement.append(`<td>${escapeHtml(output.values[caseIndex])}</td>`);
    }

    $('.testbench-manual-panel .group-label').text(data.groups[groupIndex].label);
    $('.testbench-manual-panel .case-label').text(caseIndex + 1);
}

/**
 * UI Function
 * Set the current test case result on the UI
 * @param {Object} data - Object containing the test data
 * @param {Map} result - Map containing the output values (returned by getOutputValues())
 */
function setUIResult(testbenchData, result) {
    const data = testbenchData.testData;
    const groupIndex = testbenchData.currentGroup;
    const caseIndex = testbenchData.currentCase;
    const resultElement = $('#tb-manual-table-test-result');
    let inputCount = data.groups[0].inputs.length;
    resultElement.empty();
    resultElement.append('<td>Result</td>');
    while (inputCount--) {
        resultElement.append('<td> - </td>');
    }

    for (const output of result.keys()) {
        const resultValue = result.get(output);
        const expectedValue = data.groups[groupIndex].outputs.find((dataOutput) => dataOutput.label === output).values[caseIndex];
        const color = resultValue === expectedValue ? "#17FC12" : "#FF1616";
        resultElement.append(`<td style="color: ${color}">${escapeHtml(resultValue)}</td>`);
    }
}

/**
 * Use this function to navigate to test creator. This function starts the storage listener
 * so the test is loaded directly into the simulator
 * @param {string} type - 'create', 'edit' or 'result'
 * @param {String} dataString - data in JSON string to load in case of 'edit' and 'result'  
 */
function openCreator(type, dataString) {
    const popupHeight = 800;
    const popupWidth = 1200;
    const popupTop = ( window.height - popupHeight ) / 2;
    const popupLeft = ( window.width - popupWidth ) / 2;
    const POPUP_STYLE_STRING = `height=${popupHeight},width=${popupWidth},top=${popupTop},left=${popupLeft}`;
    let popUp;

    /* Listener to catch testData from pop up and load it onto the testbench */
    const dataListener = (message) => {
        if (message.origin !== window.origin || message.data.type !== 'testData') return;

        // Check if the current scope requested the creator pop up
        const data = JSON.parse(message.data.data);
        if (data.scopeID != globalScope.id) return;

        // Load test data onto the scope
        runTestBench(data.testData, globalScope, CONTEXT.CONTEXT_SIMULATOR);
        // Unbind event listener
        $(window).off('message', dataListener);
        // Close the 'Pop up is open' dialog
        $('#setTestbenchData').dialog('close');
    }

    if (type === 'create') {
        const url = `${TESTBENCH_CREATOR_PATH}?scopeID=${globalScope.id}&popUp=true`;
        popUp = window.open(url, 'popupWindow', POPUP_STYLE_STRING);
        creatorOpenPrompt(popUp);
        window.addEventListener('message', dataListener);
    }

    if (type === 'edit') {
        const url = `${TESTBENCH_CREATOR_PATH}?scopeID=${globalScope.id}&data=${dataString}&popUp=true`;
        popUp = window.open(url, 'popupWindow', POPUP_STYLE_STRING);
        creatorOpenPrompt(popUp);
        window.addEventListener('message', dataListener);
    }

    if (type === 'result') {
        const url = `${TESTBENCH_CREATOR_PATH}?scopeID=${globalScope.id}&result=${dataString}&popUp=true`;
        popUp = window.open(url, 'popupWindow', POPUP_STYLE_STRING);
    }

    // Check if popup was closed (in case it was closed by window's X button), then close dialog
    if (popUp){
        const checkPopUp = setInterval(() => {
            if (popUp.closed) {
                $('#setTestbenchData').dialog('close');
                $(window).off('message', dataListener);
                clearInterval(checkPopUp);
            }
        }, 1000);
    }
}
