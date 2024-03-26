/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as main from './main'
import { test_deleteAllRequiredEnvVars, test_setEnvVar } from './lib/github-utils/github-env-vars'
import { ActionInputs } from './main'
import * as listGithub from './lib/github-utils/list-github-release-assets'
import type { TauriSemiUpdater } from './lib/tauri-utils/tauri-semi-updater-assembler'
import * as tauriSemiUpdaterAssemblerModule from './lib/tauri-utils/tauri-semi-updater-assembler'
import * as tauriUpdaterAssemblerGithub from './lib/tauri-utils/tauri-updater-assembler-github'
import * as githubUploadModule from './lib/github-utils/github-upload'
import { AssembleSemiUpdaterParams } from './lib/tauri-utils/tauri-semi-updater-assembler'
import { AssembleUpdaterFromSemiParams, TauriUpdater } from './lib/tauri-utils/tauri-updater-assembler-github'
import { UploadTextParams } from './lib/github-utils/github-upload'
import { type GithubAsset } from './lib/github-utils/github-asset'

// Mocked functions
let errorMock: jest.SpiedFunction<typeof core.error>
let getInputMock: jest.SpiedFunction<typeof core.getInput>
let getBooleanInputMock: jest.SpiedFunction<typeof core.getBooleanInput>
let setFailedMock: jest.SpiedFunction<typeof core.setFailed>
let setOutputMock: jest.SpiedFunction<typeof core.setOutput>
let listGithubReleaseAssetsMock: jest.SpiedFunction<typeof listGithub.listGithubReleaseAssets>
let assembleUpdaterFromSemiMock: jest.SpiedFunction<typeof tauriUpdaterAssemblerGithub.assembleUpdaterFromSemi>
let uploadTextAsAssetMock: jest.SpiedFunction<typeof githubUploadModule.uploadTextAsAsset>

// Keep original implementation and spy
const runMock = jest.spyOn(main, 'run')
const assembleSemiUpdaterMock = jest.spyOn(tauriSemiUpdaterAssemblerModule, 'assembleSemiUpdater')

const THE_GITHUB_TOKEN = 'unit-test-token'
const THE_GITHUB_OWNER = 'the-owner'
const THE_GITHUB_REPO = 'the-repo'
const THE_GITHUB_REPOSITORY = `${THE_GITHUB_OWNER}/${THE_GITHUB_REPO}`

const setAllValidRequiredEnvVars = (): void => {
  test_setEnvVar('GITHUB_TOKEN', THE_GITHUB_TOKEN)
  test_setEnvVar('GITHUB_REPOSITORY', THE_GITHUB_REPOSITORY)
}

const allAssets: GithubAsset[] = [
  // macOS Silicon (darwin-aarch64)
  { url: 'https://example.com/aarch64-apple-darwin.xxx_0.0.18_aarch64.app.tar.gz/0000', name: 'aarch64-apple-darwin.xxx_0.0.18_aarch64.app.tar.gz' },
  { url: 'https://example.com/aarch64-apple-darwin.xxx_0.0.18_aarch64.dmg/0000', name: 'aarch64-apple-darwin.xxx_0.0.18_aarch64.dmg' },
  { url: 'https://example.com/aarch64-apple-darwin.xxx_0.0.18_aarch64.updater.app.tar.gz/0000', name: 'aarch64-apple-darwin.xxx_0.0.18_aarch64.updater.app.tar.gz' },
  { url: 'https://example.com/aarch64-apple-darwin.xxx_0.0.18_aarch64.updater.app.tar.gz.sig/0000', name: 'aarch64-apple-darwin.xxx_0.0.18_aarch64.updater.app.tar.gz.sig' },
]

const expectedSemiUpdater: TauriSemiUpdater = {
  version: '0.0.0',
  notes: 'Version 0.0.0 brings enhancements and bug fixes for improved performance and stability.',
  pub_date: '2020-06-22T19:25:57Z',
  platformsPlaceholder: {
    'darwin-aarch64': {
      updater: {
        url: 'https://example.com/aarch64-apple-darwin.xxx_0.0.18_aarch64.updater.app.tar.gz/0000',
        name: 'aarch64-apple-darwin.xxx_0.0.18_aarch64.updater.app.tar.gz',
      },
      signature: {
        url: 'https://example.com/aarch64-apple-darwin.xxx_0.0.18_aarch64.updater.app.tar.gz.sig/0000',
        name: 'aarch64-apple-darwin.xxx_0.0.18_aarch64.updater.app.tar.gz.sig',
      },
    },
  },
}

const expectedUpdater: TauriUpdater = {
  version: 'unite-test-version',
  notes: 'unite-test-notes',
  pub_date: 'unite-test-pub-date',
  platforms: {
    'darwin-aarch64': {
      url: 'demo-signature-darwin-aarch64-url',
      signature: 'demo-signature-darwin-aarch64-signature',
    },
  },
}

describe('run', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Unset all env vars
    test_deleteAllRequiredEnvVars()

    errorMock = jest.spyOn(core, 'error').mockImplementation()
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
    getBooleanInputMock = jest.spyOn(core, 'getBooleanInput').mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
    setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()
    listGithubReleaseAssetsMock = jest.spyOn(listGithub, 'listGithubReleaseAssets').mockResolvedValue(allAssets)
    assembleUpdaterFromSemiMock = jest.spyOn(tauriUpdaterAssemblerGithub, 'assembleUpdaterFromSemi').mockResolvedValue(expectedUpdater)
    uploadTextAsAssetMock = jest.spyOn(githubUploadModule, 'uploadTextAsAsset').mockImplementation()
  })

  test.each([
    {
      inputs: { releaseId: '123', appVersion: '0.0.0', preferUniversal: false, preferNsis: false, pubDate: '2020-06-22T19:25:57Z', updaterName: 'my-test-updater.json' },
    },
    {
      inputs: { releaseId: '123', appVersion: '0.0.0', preferUniversal: true, preferNsis: true, pubDate: '2020-06-22T19:25:57Z', updaterName: 'my-test-updater.json' },
    },
  ])('Action must run successfully with $inputs', async ({ inputs }) => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name as ActionInputs) {
        // export type ActionInputs = 'releaseId' | 'appVersion' | 'preferUniversal' | 'preferNsis' | 'pubDate' | 'updaterName'
        case 'releaseId':
          return inputs.releaseId
        case 'appVersion':
          return inputs.appVersion
        case 'pubDate':
          return inputs.pubDate
        case 'updaterName':
          return inputs.updaterName
        default:
          return ''
      }
    })
    getBooleanInputMock.mockImplementation(name => {
      switch (name as ActionInputs) {
        case 'preferUniversal':
          return inputs.preferUniversal
        case 'preferNsis':
          return inputs.preferNsis
        default:
          return false
      }
    })

    setAllValidRequiredEnvVars()
    await main.run()
    expect(runMock).toHaveBeenCalledTimes(1)
    expect(runMock).toHaveReturned()

    expect(listGithubReleaseAssetsMock).toHaveBeenCalledTimes(1)
    expect(listGithubReleaseAssetsMock).toHaveBeenNthCalledWith(1, { githubToken: THE_GITHUB_TOKEN, repo: THE_GITHUB_REPO, owner: THE_GITHUB_OWNER, releaseId: +inputs.releaseId })

    expect(assembleSemiUpdaterMock).toHaveBeenCalledTimes(1)
    expect(assembleSemiUpdaterMock).toHaveBeenNthCalledWith(1, {
      appVersion: inputs.appVersion,
      pubDate: inputs.pubDate,
      preferNsis: inputs.preferNsis,
      preferUniversal: inputs.preferUniversal,
      assets: allAssets,
    } as AssembleSemiUpdaterParams)

    expect(assembleUpdaterFromSemiMock).toHaveBeenCalledTimes(1)
    expect(assembleUpdaterFromSemiMock).toHaveBeenNthCalledWith(1, { githubToken: THE_GITHUB_TOKEN, semiUpdater: expectedSemiUpdater } as AssembleUpdaterFromSemiParams)

    expect(uploadTextAsAssetMock).toHaveBeenCalledTimes(1)
    expect(uploadTextAsAssetMock).toHaveBeenNthCalledWith(1, {
      repo: THE_GITHUB_REPO,
      owner: THE_GITHUB_OWNER,
      releaseId: +inputs.releaseId,
      name: inputs.updaterName,
      githubToken: THE_GITHUB_TOKEN,
      text: JSON.stringify(expectedUpdater),
    } as UploadTextParams)

    expect(setOutputMock).not.toHaveBeenCalled()
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(errorMock).not.toHaveBeenCalled()
  })
})
