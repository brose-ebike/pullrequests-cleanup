import * as core from '@actions/core';
import * as github from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';

import { v4 as uuidv4 } from 'uuid';

interface PullRequestResponse {
    data: {
        repository: {
            edges: Array<
                {
                    node: {
                        id: string,
                        number: number,
                        title: string
                    }
                }
            >
        }
    }
}

async function findPullRequests(octokit: InstanceType<typeof GitHub>, repo: {owner: string, repo: string}): Promise<PullRequestResponse> {
    return await octokit.graphql<PullRequestResponse>(`query {
        repository(owner:"${repo.owner}", name:"${repo.repo}") {
          pullRequests(first:100, states: [OPEN]) {
            edges {
              node {
                id,
                number,
                title
              }
            }
          }
        }
      }`);
}

function closePullRequest(octokit: InstanceType<typeof GitHub>, id: string, comment: string){
    const mutationId = uuidv4()
    octokit.graphql(`mutation {
        addComment(input: {subjectId:"${id}", body:"${comment}", clientMutationId:"${mutationId}"}) {
          clientMutationId
        }, 
        closePullRequest(input: {pullRequestId: "${id}", clientMutationId:"${mutationId}"}) {
          clientMutationId
        }
      }`)
}

async function main() {
    // Input
    const token = core.getInput('token');
    const pattern = core.getInput('pattern');
    const excludes = core.getInput('excludes');
    const comment = core.getInput('comment');
    // Prepare Input
    const cPattern = new RegExp(pattern);
    const cExcludes = excludes.split(",").filter(it => it !== "");
    const octokit = github.getOctokit(token)
    // Close PRs
    const response = await findPullRequests(octokit, github.context.repo)
    const prs = response.data.repository.edges
        .filter((pr) => cPattern.test(pr.node.title))
        .filter((pr) => !cExcludes.includes(pr.node.number.toString()))
        .map((pr) => {
            closePullRequest(octokit, pr.node.id, comment)
        });
    const result = await Promise.all(prs)
    // TODO handle result
}
main().catch((error) => {
    core.setFailed(error.message);
})