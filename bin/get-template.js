#! /usr/bin/env node
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const axios = require('axios');

const ALIAS_URL = 'https://raw.githubusercontent.com/get-template/alias/main/aliases.txt';

async function getTemplate() {
	const args = process.argv.slice(2);

	const template = args[0];
	const directory = args[1] || '.';

	const ci = !!args.find(flag => flag === '--ci');

	let gitDestination;
	let postDownloadCommand;
	
	// Util functions
	function error(message, details) {
		console.error(`Error: ${message}`);

		if (details) {
			console.error(details);
		}

		return process.exit(1);
	}
	
	// Check template exists
	if (!template) {
		return error('A template must be specified');
	}
	
	// Check directory is empty
	try {
		const { stdout } = await exec(`ls ${directory}`);
		if (stdout) {
			return error('Directory must be empty!');
		}
	} catch (e) {
		if (e?.stderr && !e.stderr.includes('No such file or directory')) {
			return error('Could not list directory', e);
		}
	}

	// Check if template is an alias
	if (!template.includes('/')) {
		console.log('Checking template from aliases...');

		let list;

		try {
			const request = await axios.get(ALIAS_URL);
			list = request.data;
		} catch (e) {
			return error('Could not get aliases list', e);
		}

		const lines = list.split("\n");

		for (let line of lines) {
			line = line.trim();

			const [alias, destination, command] = line.split('=');

			if (alias === template) {
				gitDestination = destination;
				console.log('Alias found!');

				if (command) {
					postDownloadCommand = command;
				}

				break;
			}
		}
	} else {
		gitDestination = `git@github.com:${template}.git`
	}

	if (!gitDestination) {
		return error(`Could not find "${template}" alias`);
	}

	// If CI, stop script
	if (ci) {
		return console.log('CI finished');
	}

	// Download template
	try {
		console.log(`Downloading template from ${gitDestination}...`);
		await exec(`git clone ${gitDestination} ${directory}`);
	} catch (e) {
		return error('Could not clone repository', e);
	}
	
	// Remove .git
	try {
		console.log('Removing .git...');
		await exec(`cd ${directory}; rm -rf .git`);
	} catch (e) {
		return error('Could not remove .git', e);
	}

	// Initialize .git
	try {
		console.log('Initializing new git...');
		await exec(`cd ${directory}; git init`);
	} catch (e) {
		return error('Could not initialize git', e);
	}

	// Execute command
	if (postDownloadCommand) {
		try {
			console.log(`Executing post-download command (${postDownloadCommand})...`);
			await exec(`cd ${directory}; ${postDownloadCommand}`);
		} catch (e) {
			return error('Could not execute command', e);
		}
	}

	// Finish
	console.log('Template successfully downloaded!', `You can find it ${(directory === '.' ? 'in the current directory' : `in ${directory}`)}`);
}

module.exports = getTemplate();
