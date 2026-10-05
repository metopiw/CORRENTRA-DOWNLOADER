using System.Net;
using Correntra.Core.Security;

namespace Correntra.Transfer;

// Raw Cookie headers bypass a handler's cookie jar and would otherwise survive
// cross-host redirects. Forward a browser session only to the original origin.
internal sealed class HttpRedirectHandler(HttpMessageHandler innerHandler) : DelegatingHandler(innerHandler)
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        HttpRequestMessage current = request;
        try
        {
            for (int redirects = 0; ; redirects++)
            {
                HttpResponseMessage response = await base.SendAsync(current, cancellationToken).ConfigureAwait(false);
                if (response.StatusCode is not (HttpStatusCode.MovedPermanently or HttpStatusCode.Redirect or
                    HttpStatusCode.SeeOther or HttpStatusCode.TemporaryRedirect or HttpStatusCode.PermanentRedirect) ||
                    response.Headers.Location is not { } location)
                {
                    return response;
                }

                Uri target = new(current.RequestUri!, location);
                response.Dispose();
                if (redirects >= 20 || target.Scheme is not ("http" or "https") ||
                    (current.RequestUri!.Scheme == "https" && target.Scheme != "https"))
                {
                    throw new HttpRequestException("The download redirect is invalid or exceeds the redirect limit.");
                }

                var next = new HttpRequestMessage(current.Method, target);
                bool sameOrigin = current.RequestUri!.GetLeftPart(UriPartial.Authority)
                    .Equals(target.GetLeftPart(UriPartial.Authority), StringComparison.OrdinalIgnoreCase);
                foreach (var header in current.Headers)
                {
                    if (sameOrigin || !HttpHeaderSet.IsSensitiveName(header.Key))
                    {
                        next.Headers.TryAddWithoutValidation(header.Key, header.Value);
                    }
                }

                if (!ReferenceEquals(current, request)) current.Dispose();
                current = next;
            }
        }
        finally
        {
            if (!ReferenceEquals(current, request)) current.Dispose();
        }
    }
}
