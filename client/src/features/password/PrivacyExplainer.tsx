/**
 * US-05: the shared explanation of how the breach check (US-01) protects a
 * password. It is rendered in two places, and both must say the same thing:
 *
 *  - inside a "How this works" disclosure directly above the breach checker
 *    (`BreachChecker`), and
 *  - as the body of the `/learn/password-privacy` page (`PasswordPrivacy`).
 *
 * Every claim here is checked against the code that actually runs the check:
 * `shared/src/password/hibp.ts` and
 * `client/src/features/password/breach-check.ts`. Keep it that way. In
 * particular, do not claim HIBP "learns nothing but the prefix": the request is
 * a normal cross-origin fetch, so HIBP's servers still see the connection's IP
 * address, the browser's user-agent string, and the `Origin` header. The
 * accurate promise is that it learns nothing *about the password* beyond the
 * first five characters of its SHA-1 hash.
 */

/** HIBP's public documentation for the range API and the padding option. */
export const HIBP_RANGE_DOCS_URL =
  "https://haveibeenpwned.com/API/v3#SearchingPwnedPasswordsByRange";
export const HIBP_PADDING_DOCS_URL =
  "https://haveibeenpwned.com/API/v3#PwnedPasswordsPadding";

export function PrivacyExplainer() {
  return (
    <div className="pw-privacy__prose">
      <h2>The check runs in your browser</h2>
      <p>
        When you check a password, the work happens on your own device. Your
        browser turns the password into a hash with a one-way function called
        SHA-1. A hash is a fixed string of 40 letters and numbers. There is no
        way to turn it back into the password it came from.
      </p>
      <p>
        The password stays in the page for only as long as the check needs it.
        It is never written to disk, and it is cleared from memory when you
        leave the page.
      </p>

      <h2>Only the first five characters are sent</h2>
      <p>
        Your browser sends just the first five characters of the hash to Have I
        Been Pwned, a well-known service that collects passwords from public
        data breaches. The other 35 characters never leave your browser.
      </p>
      <p>
        Those five characters match many thousands of different hashes, so the
        service cannot tell which password you had in mind. It sends back the
        full list of hashes it knows that start with the same five characters,
        along with how often each one has turned up in a breach. Your browser
        compares that list against the full hash on its own. If it finds a
        match, it shows you the count. The answer is never sent anywhere.
      </p>

      <h2>The reply is padded</h2>
      <p>
        Soteria asks the service to add a random number of fake entries to its
        reply. This is the service&rsquo;s <strong>Add-Padding</strong> option.
        Padding keeps every reply close to the same size, so someone watching
        your network cannot guess the result from how much data comes back.
      </p>

      <h2>What Have I Been Pwned can and cannot learn</h2>
      <p>
        It never receives your password or the full hash, and it cannot work out
        which password you checked from a five-character prefix.
      </p>
      <p>
        It does see the same routine details that any site you connect to
        receives: your IP address, your browser&rsquo;s user-agent string, and
        the site the request comes from (the <code>Origin</code> header, which
        the browser attaches to this kind of cross-site request). So the honest
        way to put it is that Have I Been Pwned learns nothing{" "}
        <em>about your password</em> beyond the first five characters of its
        SHA-1 hash.
      </p>

      <h2>What Soteria&rsquo;s server does</h2>
      <p>
        Nothing. The check runs entirely between your browser and Have I Been
        Pwned. Soteria&rsquo;s server never receives your password, the hash, or
        the result. Nothing you type here is saved, logged, or stored, on your
        device or anywhere else.
      </p>

      <h2>Read the source</h2>
      <p>Have I Been Pwned documents this API in public:</p>
      <ul>
        <li>
          <a href={HIBP_RANGE_DOCS_URL} target="_blank" rel="noreferrer">
            Pwned Passwords range API
          </a>
        </li>
        <li>
          <a href={HIBP_PADDING_DOCS_URL} target="_blank" rel="noreferrer">
            Padding the range response
          </a>
        </li>
      </ul>
    </div>
  );
}
