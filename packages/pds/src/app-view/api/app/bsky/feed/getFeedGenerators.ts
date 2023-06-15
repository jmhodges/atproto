import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedGenerators({
    auth: ctx.accessVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did
      if (ctx.canProxy(req)) {
        const res = await ctx.appviewAgent.api.app.bsky.feed.getFeedGenerators(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const { feeds } = params

      const feedService = ctx.services.appView.feed(ctx.db)

      const genViews = await feedService.getFeedGeneratorViews(feeds, requester)
      const genList = Object.values(genViews)

      const creators = genList.map((gen) => gen.creator)
      const profiles = await feedService.getActorViews(creators, requester)

      const feedViews = genList.map((gen) =>
        feedService.views.formatFeedGeneratorView(gen, profiles),
      )

      return {
        encoding: 'application/json',
        body: {
          feeds: feedViews,
        },
      }
    },
  })
}