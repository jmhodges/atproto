/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth } from '@atproto/xrpc-server'
import * as AppBskyActorDefs from '../actor/defs'

export interface QueryParams {
  actor: string
  limit: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  subject: AppBskyActorDefs.ProfileView
  cursor?: string
  follows: AppBskyActorDefs.ProfileView[]
  [k: string]: unknown
}

export type HandlerInput = undefined

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | HandlerSuccess
export type Handler<HA extends HandlerAuth = never> = (ctx: {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
}) => Promise<HandlerOutput> | HandlerOutput
