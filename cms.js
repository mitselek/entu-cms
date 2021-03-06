#!/usr/bin/env node

var fs   = require('fs')
var fse  = require('fs-extra')
var jade = require('jade')
var md   = require('markdown-it')()
var path = require('path')
var yaml = require('js-yaml')



// Open config.yaml
try {
    appConfFile = process.argv[2] || path.join(__dirname, 'config.yaml')
    appConf = yaml.safeLoad(fs.readFileSync(appConfFile))
} catch (e) {
    console.error('Invalid configuration file: ' + appConfFile)
    console.error(e.message)
    process.exit(1)
}



// Set config variables
appConf.locales = appConf.locales || '.'
appConf.source  = appConf.source  || path.join(__dirname, 'source')
appConf.build   = appConf.build   || path.join(__dirname, 'build')
appConf.timeout = appConf.timeout || 60

if(appConf.source.substr(0, 1) === '.') {
    appConf.source = path.join(path.dirname(appConfFile), appConf.source)
}
if(appConf.build.substr(0, 1) === '.') {
    appConf.build = path.join(path.dirname(appConfFile), appConf.build)
}
if(appConf.jade.basedir.substr(0, 1) === '.') {
    appConf.jade.basedir = path.join(path.dirname(appConfFile), appConf.jade.basedir)
}



// Markdown-it wrapper to handle empty text
var markdown = function(text) {
    if(text) {
        return md.render(text)
    } else {
        return ''
    }
}

// Returns file path with locale if exists
var getFilePath = function(dirName, fileName, locale) {
    var localeFile = fileName.split('.')
    localeFile.splice(localeFile.length - 1, 0, locale)

    var localeFilePath = path.join(dirName, localeFile.join('.'))
    var filePath = path.join(dirName, fileName)

    if (fs.existsSync(localeFilePath)) {
        return localeFilePath
    } else if (fs.existsSync(filePath)) {
        return filePath
    } else {
        return false
    }
}



var worker = function() {
    console.log('Started to scan folder ' + appConf.source)
    htmlFiles = []
    fse.walk(appConf.source)
        .on('data', function (item) {
            if(item.path.indexOf('/_') > -1) { return }

            for (var l in appConf.locales) {
                try {
                    if (!appConf.locales.hasOwnProperty(l)) { continue }

                    var jadeFile = getFilePath(item.path, 'index.jade', appConf.locales[l])
                    if (!jadeFile) { continue }

                    var configFile = getFilePath(item.path, 'config.yaml', appConf.locales[l])
                    var config = {}
                    if (configFile) {
                        config = yaml.safeLoad(fs.readFileSync(configFile))
                    }

                    var dataFile = getFilePath(item.path, 'data.yaml', appConf.locales[l])
                    var data = {}
                    if (dataFile) {
                        data = yaml.safeLoad(fs.readFileSync(dataFile))
                    }

                    data.pretty = appConf.jade.pretty
                    data.basedir = appConf.jade.basedir
                    data.md = markdown

                    var html = jade.renderFile(jadeFile, data)
                    var htmlDir = path.dirname(jadeFile.replace(appConf.source, path.join(appConf.build,  appConf.locales[l])))
                    var htmlFile = path.join(htmlDir, 'index.html')

                    htmlFiles.push(htmlFile)
                    fse.outputFile(htmlFile, html, function(err, a) {
                        if(err) { console.log(err) }
                    })
                } catch (e) {
                    console.error(e.message)
                }
            }
        })
        .on('end', function () {
            // console.log(htmlFiles.join('\n'))
            setTimeout(worker, (appConf.timeout * 1000))
        })
}
worker()
