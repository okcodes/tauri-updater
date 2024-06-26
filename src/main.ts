import * as core from '@actions/core'
import { assembleSemiUpdater } from './lib/tauri-utils/tauri-semi-updater-assembler'
import { listGithubReleaseAssets } from './lib/github-utils/list-github-release-assets'
import { getRequiredEnvVars } from './lib/github-utils/github-env-vars'
import { assembleUpdaterFromSemi, REWRITE_UPDATER_URL_REGEX } from './lib/tauri-utils/tauri-updater-assembler-github'
import { uploadTextAsAsset } from './lib/github-utils/github-upload'
import path from 'path'
import { VERSION } from './version'

export type ActionInputs = 'releaseId' | 'appVersion' | 'preferUniversal' | 'preferNsis' | 'pubDate' | 'updaterName' | 'updaterUrlTemplate'

const input = (name: ActionInputs, options: core.InputOptions): string => core.getInput(name, options)
const booleanInput = (name: ActionInputs, options: core.InputOptions): boolean => core.getBooleanInput(name, options)

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  console.log(`Running okcodes/tauri-updater v${VERSION}`)

  try {
    console.log('Running Assemble Updater Command')
    const { GITHUB_TOKEN, GITHUB_REPOSITORY } = getRequiredEnvVars()

    if (!GITHUB_TOKEN) {
      core.setFailed('GITHUB_TOKEN is required')
      return
    }

    if (!GITHUB_REPOSITORY) {
      core.setFailed('GITHUB_REPOSITORY is required')
      return
    }

    const [owner, repo] = GITHUB_REPOSITORY.split('/')

    if (!owner || !repo) {
      core.setFailed('GITHUB_REPOSITORY must be called with the format owner/repo')
      return
    }

    const releaseId = +input('releaseId', { required: true, trimWhitespace: true })
    const appVersion = input('appVersion', { required: true, trimWhitespace: true })
    const preferUniversal = booleanInput('preferUniversal', { required: true, trimWhitespace: true })
    const preferNsis = booleanInput('preferNsis', { required: true, trimWhitespace: true })
    const pubDate = input('pubDate', { required: true, trimWhitespace: true })
    const updaterName = path.basename(input('updaterName', { required: true, trimWhitespace: true }))
    const updaterUrlTemplate = input('updaterUrlTemplate', { required: false, trimWhitespace: true })

    // Validate release ID
    if (isNaN(releaseId)) {
      core.setFailed('The input "releaseId" must be a number.')
      return
    }

    if (!updaterName.endsWith('.json') || !path.basename(updaterName, '.json')) {
      core.setFailed('The input "updaterName" must be a valid file name with the .json extension.')
      return
    }

    if (updaterUrlTemplate && !REWRITE_UPDATER_URL_REGEX().test(updaterUrlTemplate)) {
      core.setFailed('If using the "updaterUrlTemplate" it must include the "{ASSET_NAME}" placeholder.')
      return
    }

    const assets = await listGithubReleaseAssets({ githubToken: GITHUB_TOKEN, repo, owner, releaseId })
    const semiUpdater = assembleSemiUpdater({ appVersion, pubDate, assets, preferUniversal, preferNsis })
    console.log('Semi updater assembled, will assemble final updater', semiUpdater)
    const updater = await assembleUpdaterFromSemi({ semiUpdater, githubToken: GITHUB_TOKEN, updaterUrlTemplate })
    console.log('Final updater assembled, will upload', updater)
    await uploadTextAsAsset({ name: updaterName, text: JSON.stringify(updater), releaseId, owner, repo, githubToken: GITHUB_TOKEN })
  } catch (error) {
    // Fail the workflow run if an error occurs
    console.error('Error assembling updater', error)
    core.setFailed((error as Error).message)
  }
}
