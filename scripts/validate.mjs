#!/usr/bin/env node
import { runPythonScript } from './node-python.mjs';

process.exit(runPythonScript('scripts/validate_base_data.py'));
