import fs from 'fs/promises'
import AtpAgent from '@atproto/api'
import { InputSchema as TakeActionInput } from '@atproto/api/src/client/types/com/atproto/admin/takeModerationAction'
import { InputSchema as CreateReportInput } from '@atproto/api/src/client/types/com/atproto/report/create'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import { adminAuth } from '../_util'

// Makes it simple to create data via the XRPC client,
// and keeps track of all created data in memory for convenience.

let AVATAR_IMG: Uint8Array | undefined

export type ImageRef = {
  image: { cid: string; mimeType: string }
  alt: string
}

export class RecordRef {
  uri: AtUri
  cid: CID

  constructor(uri: AtUri | string, cid: CID | string) {
    this.uri = new AtUri(uri.toString())
    this.cid = CID.parse(cid.toString())
  }

  get raw(): { uri: string; cid: string } {
    return {
      uri: this.uri.toString(),
      cid: this.cid.toString(),
    }
  }

  get uriStr(): string {
    return this.uri.toString()
  }

  get cidStr(): string {
    return this.cid.toString()
  }
}

export class SeedClient {
  accounts: Record<
    string,
    {
      did: string
      accessJwt: string
      refreshJwt: string
      handle: string
      email: string
      password: string
    }
  >
  profiles: Record<
    string,
    {
      displayName: string
      description: string
      avatar: { cid: string; mimeType: string }
      ref: RecordRef
    }
  >
  follows: Record<string, Record<string, RecordRef>>
  posts: Record<
    string,
    { text: string; ref: RecordRef; images: ImageRef[]; quote?: RecordRef }[]
  >
  likes: Record<string, Record<string, AtUri>>
  replies: Record<string, { text: string; ref: RecordRef }[]>
  reposts: Record<string, RecordRef[]>
  dids: Record<string, string>

  constructor(public agent: AtpAgent) {
    this.accounts = {}
    this.profiles = {}
    this.follows = {}
    this.posts = {}
    this.likes = {}
    this.replies = {}
    this.reposts = {}
    this.dids = {}
  }

  async createAccount(
    shortName: string,
    params: {
      handle: string
      email: string
      password: string
    },
  ) {
    const { data: account } = await this.agent.api.com.atproto.account.create(
      params,
    )
    this.dids[shortName] = account.did
    this.accounts[account.did] = {
      ...account,
      email: params.email,
      password: params.password,
    }
    return this.accounts[account.did]
  }

  async createProfile(
    by: string,
    displayName: string,
    description: string,
    fromUser?: string,
  ) {
    AVATAR_IMG ??= await fs.readFile(
      'tests/image/fixtures/key-portrait-small.jpg',
    )

    let avatarCid
    {
      const res = await this.agent.api.com.atproto.blob.upload(AVATAR_IMG, {
        encoding: 'image/jpeg',
        headers: this.getHeaders(fromUser || by),
      } as any)
      avatarCid = res.data.cid
    }

    {
      const res = await this.agent.api.app.bsky.actor.profile.create(
        { did: by },
        {
          displayName,
          description,
          avatar: { cid: avatarCid, mimeType: 'image/jpeg' },
        },
        this.getHeaders(fromUser || by),
      )
      this.profiles[by] = {
        displayName,
        description,
        avatar: { cid: avatarCid, mimeType: 'image/jpeg' },
        ref: new RecordRef(res.uri, res.cid),
      }
    }
    return this.profiles[by]
  }

  async follow(from: string, to: string) {
    const res = await this.agent.api.app.bsky.graph.follow.create(
      { did: from },
      {
        subject: to,
        createdAt: new Date().toISOString(),
      },
      this.getHeaders(from),
    )
    this.follows[from] ??= {}
    this.follows[from][to] = new RecordRef(res.uri, res.cid)
    return this.follows[from][to]
  }

  async post(
    by: string,
    text: string,
    entities?: any,
    images?: ImageRef[],
    quote?: RecordRef,
  ) {
    if (images && quote) throw new Error("Can't embed images and a quote")
    const embed = images
      ? {
          $type: 'app.bsky.embed.images',
          images,
        }
      : quote
      ? {
          $type: 'app.bsky.embed.record',
          record: { uri: quote.uriStr, cid: quote.cidStr },
        }
      : undefined
    const res = await this.agent.api.app.bsky.feed.post.create(
      { did: by },
      {
        text: text,
        entities,
        embed,
        createdAt: new Date().toISOString(),
      },
      this.getHeaders(by),
    )
    this.posts[by] ??= []
    const post = {
      text,
      ref: new RecordRef(res.uri, res.cid),
      images: images ?? [],
      quote,
    }
    this.posts[by].push(post)
    return post
  }

  async deletePost(by: string, uri: AtUri) {
    await this.agent.api.app.bsky.feed.post.delete(
      {
        did: by,
        rkey: uri.rkey,
      },
      this.getHeaders(by),
    )
  }

  async uploadFile(
    by: string,
    filePath: string,
    encoding: string,
  ): Promise<ImageRef> {
    const file = await fs.readFile(filePath)
    const res = await this.agent.api.com.atproto.blob.upload(file, {
      headers: this.getHeaders(by),
      encoding,
    } as any)
    return { image: { cid: res.data.cid, mimeType: encoding }, alt: filePath }
  }

  async like(by: string, subject: RecordRef) {
    const res = await this.agent.api.app.bsky.feed.like.create(
      { did: by },
      { subject: subject.raw, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.likes[by] ??= {}
    this.likes[by][subject.uriStr] = new AtUri(res.uri)
    return this.likes[by][subject.uriStr]
  }

  async reply(
    by: string,
    root: RecordRef,
    parent: RecordRef,
    text: string,
    entities?: any,
    images?: ImageRef[],
  ) {
    const embed = images
      ? {
          $type: 'app.bsky.embed.images',
          images,
        }
      : undefined
    const res = await this.agent.api.app.bsky.feed.post.create(
      { did: by },
      {
        text: text,
        reply: {
          root: root.raw,
          parent: parent.raw,
        },
        entities,
        embed,
        createdAt: new Date().toISOString(),
      },
      this.getHeaders(by),
    )
    this.replies[by] ??= []
    const reply = {
      text,
      ref: new RecordRef(res.uri, res.cid),
    }
    this.replies[by].push(reply)
    return reply
  }

  async repost(by: string, subject: RecordRef) {
    const res = await this.agent.api.app.bsky.feed.repost.create(
      { did: by },
      { subject: subject.raw, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.reposts[by] ??= []
    const repost = new RecordRef(res.uri, res.cid)
    this.reposts[by].push(repost)
    return repost
  }

  async takeModerationAction(opts: {
    action: TakeActionInput['action']
    subject: TakeActionInput['subject']
    reason?: string
    createdBy?: string
  }) {
    const {
      action,
      subject,
      reason = 'X',
      createdBy = 'did:example:admin',
    } = opts
    const result = await this.agent.api.com.atproto.admin.takeModerationAction(
      { action, subject, createdBy, reason },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
    return result.data
  }

  async reverseModerationAction(opts: {
    id: number
    reason?: string
    createdBy?: string
  }) {
    const { id, reason = 'X', createdBy = 'did:example:admin' } = opts
    const result =
      await this.agent.api.com.atproto.admin.reverseModerationAction(
        { id, reason, createdBy },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
    return result.data
  }

  async resolveReports(opts: {
    actionId: number
    reportIds: number[]
    createdBy?: string
  }) {
    const { actionId, reportIds, createdBy = 'did:example:admin' } = opts
    const result =
      await this.agent.api.com.atproto.admin.resolveModerationReports(
        { actionId, createdBy, reportIds },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
    return result.data
  }

  async createReport(opts: {
    reasonType: CreateReportInput['reasonType']
    subject: CreateReportInput['subject']
    reason?: string
    reportedBy: string
  }) {
    const { reasonType, subject, reason, reportedBy } = opts
    const result = await this.agent.api.com.atproto.report.create(
      { reasonType, subject, reason },
      {
        encoding: 'application/json',
        headers: this.getHeaders(reportedBy),
      },
    )
    return result.data
  }

  getHeaders(did: string) {
    return SeedClient.getHeaders(this.accounts[did].accessJwt)
  }

  static getHeaders(jwt: string) {
    return { authorization: `Bearer ${jwt}` }
  }
}
