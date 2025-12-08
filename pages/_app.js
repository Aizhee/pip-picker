import '../styles/globals.css'
import Head from 'next/head'

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>pip-picker — interactive package compatibility checker</title>
        <meta name="description" content="pip-picker: Search PyPI packages, compare versions, and validate compatibility for your selected Python version using PyPI metadata." />
        <meta name="keywords" content="python, pip, pypi, packages, dependency, compatibility, requirements, pip-picker" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />

        <link rel="icon" href="/img/icon1.png" type="image/png" sizes="any" />
        <link rel="shortcut icon" href="/img/icon1.png" />
        <link rel="apple-touch-icon" href="/img/icon1.png" />
        <link rel="canonical" href="/" />
        <meta name="theme-color" content="#182030" />

        {/* Open Graph / social */}
        <meta property="og:title" content="pip-picker" />
        <meta property="og:description" content="Interactive package compatibility checker using PyPI metadata." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="/" />
        <meta property="og:image" content="/img/icon1.png" />

        {/* Twitter card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="pip-picker" />
        <meta name="twitter:description" content="Interactive package compatibility checker using PyPI metadata." />
        <meta name="twitter:image" content="/img/icon1.png" />

        {/* JSON-LD structured data */}
        <script type="application/ld+json">{`{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "pip-picker",
          "url": "/",
          "description": "Search PyPI packages, compare versions, and validate compatibility for your selected Python version.",
          "publisher": {
            "@type": "Organization",
            "name": "aizhee"
          }
        }`}</script>
      </Head>
      <Component {...pageProps} />
    </>
  )
}
