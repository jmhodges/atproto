/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as AppBskyActorDefs from '../actor/defs'

export interface QueryParams {
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  notifications: Notification[]
  [k: string]: unknown
}

export interface CallOptions {
  headers?: Headers
}

export interface Response {
  success: boolean
  headers: Headers
  data: OutputSchema
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

export interface Notification {
  uri: string
  cid: string
  author: AppBskyActorDefs.WithInfo
  /** Expected values are 'like', 'repost', 'follow', 'mention', 'reply', and 'quote'. */
  reason:
    | 'like'
    | 'repost'
    | 'follow'
    | 'mention'
    | 'reply'
    | 'quote'
    | (string & {})
  reasonSubject?: string
  record: {}
  isRead: boolean
  indexedAt: string
  [k: string]: unknown
}

export function isNotification(v: unknown): v is Notification {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.notification.listNotifications#notification'
  )
}

export function validateNotification(v: unknown): ValidationResult {
  return lexicons.validate(
    'app.bsky.notification.listNotifications#notification',
    v,
  )
}