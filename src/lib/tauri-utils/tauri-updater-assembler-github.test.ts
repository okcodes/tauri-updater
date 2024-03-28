import { assembleUpdaterFromSemi, type AssembleUpdaterFromSemiParams, type TauriUpdater } from './tauri-updater-assembler-github'
import * as tauriUpdaterAssemblerGithubModule from './tauri-updater-assembler-github'

let getSignatureContentMock: jest.SpiedFunction<typeof tauriUpdaterAssemblerGithubModule.getSignatureContent>

describe('assembleUpdaterFromSemi', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getSignatureContentMock = jest.spyOn(tauriUpdaterAssemblerGithubModule, 'getSignatureContent').mockImplementation(async ({ url }) => `Signature for: ${url}`)
  })

  type SuccessTestCase = {
    inputs: AssembleUpdaterFromSemiParams
    expected: TauriUpdater
  }

  const successTestCases: SuccessTestCase[] = [
    {
      inputs: {
        githubToken: '',
        updaterUrlTemplate: '',
        semiUpdater: {
          version: '1.0.0',
          notes: 'test notes',
          platformsPlaceholder: {
            'darwin-aarch64': {
              updater: { url: 'https://example.com/darwin-aarch64/updater/12345?test=true', name: 'darwin-aarch64-updater.bin' },
              signature: { url: 'https://example.com/darwin-aarch64/signature/12345?test=true', name: 'darwin-aarch64-updater.bin.sig' },
            },
            'windows-x86_64': {
              updater: { url: 'https://example.com/windows-x86_64/updater/12345?test=true', name: 'windows-x86_64-updater.bin' },
              signature: { url: 'https://example.com/windows-x86_64/signature/12345?test=true', name: 'windows-x86_64-updater.bin.sig' },
            },
          },
          pub_date: '2020-06-22T19:25:57Z',
        },
      },
      expected: {
        version: '1.0.0',
        notes: 'test notes',
        pub_date: '2020-06-22T19:25:57Z',
        platforms: {
          'darwin-aarch64': {
            url: 'https://example.com/darwin-aarch64/updater/12345?test=true', // Keep original url since no updaterUrlTemplate is provided.
            signature: 'Signature for: https://example.com/darwin-aarch64/signature/12345?test=true',
          },
          'windows-x86_64': {
            url: 'https://example.com/windows-x86_64/updater/12345?test=true', // Keep original url since no updaterUrlTemplate is provided.
            signature: 'Signature for: https://example.com/windows-x86_64/signature/12345?test=true',
          },
        },
      },
    },
    {
      inputs: {
        githubToken: '',
        updaterUrlTemplate: 'https://my-bucket.s3.amazonaws.com/{ASSET_NAME}',
        semiUpdater: {
          version: '1.0.0',
          notes: 'test notes',
          platformsPlaceholder: {
            'darwin-aarch64': {
              updater: { url: 'https://example.com/darwin-aarch64/updater/12345?test=true', name: 'darwin-aarch64-updater.bin' },
              signature: { url: 'https://example.com/darwin-aarch64/signature/12345?test=true', name: 'darwin-aarch64-updater.bin.sig' },
            },
            'windows-x86_64': {
              updater: { url: 'https://example.com/windows-x86_64/updater/12345?test=true', name: 'windows-x86_64-updater.bin' },
              signature: { url: 'https://example.com/windows-x86_64/signature/12345?test=true', name: 'windows-x86_64-updater.bin.sig' },
            },
          },
          pub_date: '2024-06-22T19:25:57Z',
        },
      },
      expected: {
        version: '1.0.0',
        notes: 'test notes',
        pub_date: '2024-06-22T19:25:57Z',
        platforms: {
          'darwin-aarch64': {
            url: 'https://my-bucket.s3.amazonaws.com/darwin-aarch64-updater.bin', // Updater url must have been rewritten.
            signature: 'Signature for: https://example.com/darwin-aarch64/signature/12345?test=true',
          },
          'windows-x86_64': {
            url: 'https://my-bucket.s3.amazonaws.com/windows-x86_64-updater.bin', // Updater url must have been rewritten.
            signature: 'Signature for: https://example.com/windows-x86_64/signature/12345?test=true',
          },
        },
      },
    },
  ]

  test.each(successTestCases)('Must produce correct updater', async ({ inputs, expected }) => {
    const updater = await assembleUpdaterFromSemi(inputs)
    expect(updater).toEqual(expected)
    expect(getSignatureContentMock).toHaveBeenCalledTimes(Object.keys(inputs.semiUpdater.platformsPlaceholder).length)
    Object.values(inputs.semiUpdater.platformsPlaceholder).forEach((x, i) => {
      expect(getSignatureContentMock).toHaveBeenNthCalledWith(i + 1, { url: x.signature.url, githubToken: '' })
    })
  })
})
