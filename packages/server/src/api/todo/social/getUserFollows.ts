import { sql } from 'kysely'
import { Server } from '../../../lexicon'
import { InvalidRequestError } from '@adxp/xrpc-server'
import * as GetUserFollows from '../../../lexicon/types/todo/social/getUserFollows'
import * as util from './util'
import * as locals from '../../../locals'
import { paginate } from '../../../db/util'

export default function (server: Server) {
  server.todo.social.getUserFollows(
    async (params: GetUserFollows.QueryParams, _input, _req, res) => {
      const { user, limit, before } = params
      const { db } = locals.get(res)

      const creator = await util.getUserInfo(db.db, user).catch((e) => {
        throw new InvalidRequestError(`User not found: ${user}`)
      })

      let followsReq = db.db
        .selectFrom('todo_social_follow as follow')
        .where('follow.creator', '=', creator.did)
        .innerJoin('record', 'record.uri', 'follow.uri')
        .innerJoin('user as subject', 'subject.did', 'follow.subject')
        .leftJoin(
          'todo_social_profile as profile',
          'profile.creator',
          'follow.subject',
        )
        .select([
          'subject.did as did',
          'subject.username as name',
          'profile.displayName as displayName',
          'follow.createdAt as createdAt',
          'record.indexedAt as indexedAt',
        ])

      followsReq = paginate(followsReq, {
        limit,
        before,
        by: sql`follow.createdAt`,
      })

      const followsRes = await followsReq.execute()
      const follows = followsRes.map((row) => ({
        did: row.did,
        name: row.name,
        displayName: row.displayName ?? undefined,
        createdAt: row.createdAt,
        indexedAt: row.indexedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          subject: creator,
          follows,
        },
      }
    },
  )
}