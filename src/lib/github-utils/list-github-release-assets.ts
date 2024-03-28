import { Octokit } from '@octokit/rest'
import { type GithubAsset } from './github-asset'

export const listGithubReleaseAssets = async ({ githubToken, owner, repo, releaseId }: { githubToken: string; owner: string; repo: string; releaseId: number }): Promise<GithubAsset[]> => {
  try {
    console.log('Will list assets of release', { owner, repo, releaseId })
    const octokit = new Octokit({ auth: githubToken })
    let assets: GithubAsset[] = []
    let page = 1
    let hasNextPage = true
    while (hasNextPage) {
      const response = await octokit.repos.listReleaseAssets({ owner, repo, release_id: releaseId, per_page: 100, page })
      assets = assets.concat(response.data.map(({ name, url }) => ({ url, name })))
      hasNextPage = response.headers?.link?.includes('rel="next"') || false
      if (hasNextPage) {
        page++
      }
    }
    console.log(`Did list assets in ${page} pages`, assets)
    return assets
  } catch (error) {
    console.error('Unexpected error listing release assets', { owner, repo, releaseId, error })
    throw new Error(`Unexpected error listing release assets: ${(error as Error).message}`, { cause: error })
  }
}
