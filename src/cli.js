#!/usr/bin/env node

import { parseArgs, styleText } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import { scanDirectory } from './scanner.js';
import { analyzeFile, groupByExtension } from './analyzer.js';
import { formatReport } from './formatter.js';

function parseFlags(argv = process.argv) {
    const { values, positionals } = parseArgs({
        args: argv.slice(2),
        options: {
            output: {
                type: 'string',
                short: 'o'
            },
            ignore: {
                type: 'string',
                multiple: true,
                short: 'i'
            },
            help: {
                type: 'boolean',
                short: 'h'
            }
        },
        allowPositionals: true
    });

    return {
        _: positionals,
        output: values.output,
        ignore: values.ignore ?? [],
        help: values.help ?? false
    };
}

function printHelp() {
    console.log(`
RepoDoc

Usage:
  node src/cli.js [directory] [options]

Options:
  -o, --output <file>     Write report to a file
  -i, --ignore <pattern>  Ignore files or directories
  -h, --help              Show help
`);
}

export async function main(argv = process.argv) {
    try {
        const flags = parseFlags(argv);

        if (flags.help) {
            printHelp();
            return;
        }

        const rootDir = path.resolve(flags._[0] ?? '.');

        console.log(styleText('bold', 'RepoDoc'));
        console.log(`Scanning: ${rootDir}`);

        const scannedFiles = await scanDirectory(rootDir, {
            ignore: flags.ignore
        });

        const analyzedFiles = [];

        for (const filePath of scannedFiles) {
            try {
                const source = await fs.readFile(filePath, 'utf8');
                const relativePath = path.relative(rootDir, filePath);
                analyzedFiles.push(analyzeFile(relativePath, source));
            } catch (error) {
                console.log(
                    styleText('yellow', `Could not read: ${filePath}`)
                );
            }
        }

        const groups = groupByExtension(analyzedFiles);

        const result = {
            root: rootDir,
            files: analyzedFiles,
            groups
        };

        const report = formatReport(result, {
            format: 'markdown',
            root: rootDir
        });

        if (flags.output) {
            const outputPath = path.resolve(flags.output);
            await fs.writeFile(outputPath, report, 'utf8');
            console.log(
                styleText('green', `Report written to ${outputPath}`)
            );
        } else {
            console.log(report);
        }

        console.log(
            styleText('green', `Analyzed ${analyzedFiles.length} files`)
        );
    } catch (error) {
        console.error(
            styleText('red', `Error: ${error.message}`)
        );
        process.exitCode = 1;
    }
}

const isDirectRun =
    Boolean(process.argv[1]) &&
    process.argv[1]
        .replace(/\\/g, '/')
        .endsWith('/src/cli.js');

if (isDirectRun) {
    main();
}