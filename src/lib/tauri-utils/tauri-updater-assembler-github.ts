import { OS_Arch, TauriSemiUpdater } from './tauri-semi-updater-assembler'
import axios from 'axios'
import { GithubAsset } from '../github-utils/github-asset'

export type TauriUpdater = {
  version: string
  notes: string
  pub_date: string // "2020-06-22T19:25:57Z"
  platforms: Partial<
    Record<
      OS_Arch,
      {
        /**
         * Url to download the updater binary.
         */
        url: string
        /**
         * Content of the .sig file used to verify the updater binary.
         */
        signature: string
      }
    >
  >
}

export type AssembleUpdaterFromSemiParams = {
  semiUpdater: TauriSemiUpdater
  githubToken: string
  updaterUrlTemplate: string
}

export const assembleUpdaterFromSemi = async ({ semiUpdater, githubToken, updaterUrlTemplate }: AssembleUpdaterFromSemiParams): Promise<TauriUpdater> => {
  const updater: TauriUpdater = {
    version: semiUpdater.version,
    platforms: {},
    notes: semiUpdater.notes,
    pub_date: semiUpdater.pub_date,
  }

  for (const osArch in semiUpdater.platformsPlaceholder) {
    const { updater: updaterAsset, signature: signatureAsset } = semiUpdater.platformsPlaceholder[osArch as OS_Arch]!
    const signatureContent = await getSignatureContent({ url: signatureAsset.url, githubToken })
    if (signatureContent) {
      updater.platforms[osArch as OS_Arch] = {
        url: rewriteUpdaterUrl({ asset: updaterAsset, template: updaterUrlTemplate }),
        signature: signatureContent,
      }
    }
  }
  return updater
}

export const REWRITE_UPDATER_URL_REGEX = () => /\{ASSET_NAME}/gi

const rewriteUpdaterUrl = ({ template, asset }: { template: string; asset: GithubAsset }) => {
  if (!template) return asset.url
  return template.replaceAll(REWRITE_UPDATER_URL_REGEX(), asset.name)
}

export const getSignatureContent = async ({ url, githubToken }: { url: string; githubToken: string }): Promise<string> => {
  const response = await axios({
    method: 'get',
    url,
    responseType: 'text',
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: 'application/octet-stream',
    },
  })
  return response.data
}
