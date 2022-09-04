const axios = require('axios').default;
const { Octokit } = require("@octokit/rest");
const fs = require('fs');
const filesize = require('filesize');
const moment = require('moment')
const path = require('path')

function dirPath(p) {
    return path.join(__dirname, p)
}

const DATEFMT = "dddd, MMMM Do YYYY, H:mm:ss"

const github = new Octokit({
    userAgent: 'vgmstream-dl v1.0.0',
    auth: process.env.GITHUB_API_KEY
});

const regex = /[^0-9a-f]*/gm;

const pug = require('pug');

const genIndex = pug.compileFile(dirPath('src/index.pug'));


(async() => {

    console.debug("Getting Windows commit...")
    var winRequest = await axios.get("https://vgmstream-builds.s3-us-west-1.amazonaws.com/latest_id_win", {
        responseType: 'text'
    })
    var winCommitHash = winRequest.data.replace(regex, "")

    console.debug("Getting Linux commit...")

    var lxRequest = await axios.get("https://vgmstream-builds.s3-us-west-1.amazonaws.com/latest_id_lx", {
        responseType: 'text'
    })
    var lxCommitHash = lxRequest.data.replace(regex, "")

    console.debug("Getting Windows commit info from GitHub...")

    var winCommit = (await github.rest.git.getCommit({
        owner: 'vgmstream',
        repo: 'vgmstream',
        commit_sha: winCommitHash,
    })).data

    winCommit.fmtDate = moment.utc(winCommit.committer.date).format(DATEFMT)

    console.debug("Getting Linux commit info from GitHub...")

    var lxCommit = (await github.rest.git.getCommit({
        owner: 'vgmstream',
        repo: 'vgmstream',
        commit_sha: lxCommitHash,
    })).data

    lxCommit.fmtDate = moment.utc(lxCommit.committer.date).format(DATEFMT)

    console.log("Getting filesizes...")

    var urls = {
        winCmd: `https://vgmstream-builds.s3-us-west-1.amazonaws.com/${winCommit.sha}/windows/vgmstream-win.zip`,
        winFb2k: `https://vgmstream-builds.s3-us-west-1.amazonaws.com/${winCommit.sha}/windows/foo_input_vgmstream.fb2k-component`,
        lx: `https://vgmstream-builds.s3-us-west-1.amazonaws.com/${lxCommit.sha}/linux/vgmstream-cli.tar.gz`
    }

    var fileSizes = {}

    for (const url in urls) {
        var cl = (await axios.head(urls[url])).headers['content-length']
        fileSizes[url] = {
            raw: parseInt(cl),
            formatted: filesize(parseInt(cl))
        }
    }

    var locals = {
        winCommit,
        lxCommit,
        urls,
        fileSizes,
        env: process.env,
        currentDate: moment.utc().format(DATEFMT)
    }

    fs.writeFileSync("src/index.html", genIndex(locals))
    var safelocals = locals
    delete safelocals.env
    fs.writeFileSync("static/data.json", JSON.stringify(safelocals, null, 4))


})()