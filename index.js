#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const less = require("less");
const glob = require("glob");
const rimraf = require("rimraf");
const babel = require("@babel/core");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;

const REG_TSX = /\.tsx?$/;
const REG_LESS = /\.less$/;
const REG_FILE = "**/*.{ts,tsx}";

let target;
let current;

if (process.argv.indexOf("-h") > -1) {
  help();
  return;
}

process.argv.forEach(function(val, index, array) {
  if (val === "-s") {
    current = array[index + 1];
  }

  if (val === "-t") {
    target = array[index + 1];
  }
});

if (!target || !current) {
  console.error("ERROR: 缺少 -t/-s 参数");
  return;
}

rimraf.sync(target);

const files = getFiles(REG_FILE, current);
files.forEach(file => {
  const filePath = path.join(current, file);
  const targetPath = path.join(target, file);
  const targetPathJS = targetPath.replace(REG_TSX, ".js");
  const result = transformTsx(filePath);

  traverseTsxToTransform(result.ast, filePath, targetPath);
  generateJS(result.ast, targetPathJS);
});

function help() {
  console.log(
    "\nParams: \n" +
      "  -s: 要转化的源文件夹\n" +
      "  -t: 转化后输出的文件夹\n" +
      "\nUsage: \n" +
      "  tec -s components -t es\n"
  );
}

function getFiles(reg, cwd) {
  return glob.sync(reg, {
    nodir: true,
    cwd: cwd
  });
}

function traverseTsxToTransform(ast, filePath, targetPath) {
  const REG_LESS = /\.less$/;
  const REG_TSX = /\.tsx?$/;

  traverse(ast, {
    ImportDeclaration: function(file) {
      let value = file.node.source.value;

      if (REG_LESS.test(value)) {
        const lessPath = path.resolve(filePath, "..", value);
        const targetPathCSS = path
          .resolve(targetPath, "..", value)
          .replace(REG_LESS, ".css");
        const input = fs.readFileSync(lessPath).toString();

        generateCSS(input, lessPath, targetPathCSS);
        file.node.source.value = value.replace(REG_LESS, ".css");
      }

      if (REG_TSX.test(value)) {
        file.node.source.value = value.replace(REG_TSX, ".js");
      }
    }
  });
}

function transformTsx(filePath) {
  return babel.transformFileSync(filePath, {
    presets: ["@babel/preset-typescript"],
    plugins: [
      "@babel/plugin-transform-react-jsx",
      "@babel/plugin-proposal-class-properties"
    ],
    filename: filePath,
    ast: true
  });
}

function generateCSS(input, filePath, targetPath) {
  less
    .render(input, {
      filename: path.resolve(filePath)
    })
    .then(
      function(output) {
        writeFile(targetPath, output.css);
      },
      function(err) {
        throw Error(err);
      }
    );
}

function generateJS(ast, path) {
  const { code } = generator(ast);
  writeFile(path, code);
}

function writeFile(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content);
}
