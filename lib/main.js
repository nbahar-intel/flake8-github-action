"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const github = require('@actions/github');
const { GITHUB_TOKEN } = process.env;
function runFlake8() {
    return __awaiter(this, void 0, void 0, function* () {
        let myOutput = '';
        let options = {
            listeners: {
                stdout: (data) => {
                    myOutput += data.toString();
                },
            }
        };
        yield exec.exec('flake8 --exit-zero', [], options);
        return myOutput;
    });
}
// Regex the output for error lines, then format them in
function parseFlake8Output(output) {
    // Group 0: whole match
    // Group 1: filename
    // Group 2: line number
    // Group 3: column number
    // Group 4: error code
    // Group 5: error description
    let regex = new RegExp(/^(.*?):(\d+):(\d+): (\w\d+) ([\s|\w]*)/);
    let errors = output.split('\n');
    let annotations = [];
    for (let i = 0; i < errors.length; i++) {
        let error = errors[i];
        let match = error.match(regex);
        if (match) {
            // Chop `./` off the front so that Github will recognize the file path
            const normalized_path = match[1].replace('./', '');
            const line = parseInt(match[2]);
            const column = parseInt(match[3]);
            const annotation_level = 'failure';
            const annotation = {
                path: normalized_path,
                start_line: line,
                end_line: line,
                start_column: column,
                end_column: column,
                annotation_level,
                message: `[${match[4]}] ${match[5]}`,
            };
            annotations.push(annotation);
        }
    }
    return annotations;
}
function createCheck(check_name, title, annotations) {
    return __awaiter(this, void 0, void 0, function* () {
        const octokit = github.getOctokit(String(GITHUB_TOKEN));
        const res = yield octokit.checks.listForRef({
            owner: "intel-restricted",
            check_name: check_name,
            repo: "applications.validation.test-generators.oasis.oasis-content",
            ref: github.context.sha
        });
        console.log(String(GITHUB_TOKEN));
        console.log(check_name);
        console.log(github.context.repo);
        console.log(github.context.sha);
        console.log(res.data);
        // const check_run_id = res.data.check_runs[0].id;
        yield octokit.checks.create(Object.assign({}, github.context.repo, { name: "Flake8", head_sha: github.context.sha, status: "completed", conclusion: "failure", output: {
                title,
                summary: `${annotations.length} errors(s) found`,
                annotations
            } }));
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const flake8Output = yield runFlake8();
            const annotations = parseFlake8Output(flake8Output);
            if (annotations.length > 0) {
                console.log(annotations);
                const checkName = core.getInput('checkName');
                yield createCheck(checkName, "flake8 failure", annotations);
                core.setFailed(`${annotations.length} errors(s) found`);
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
