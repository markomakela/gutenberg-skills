<?php
/**
 * Plugin Name: WebAula - REST- ja XML-RPC-suojaus
 * Description: Estaa kayttajatunnusten listaamisen REST API:n users-paatepisteesta, ?author=N-kyselysta ja oEmbed-vastauksesta kirjautumattomilta. Sulkee lisaksi XML-RPC:n kokonaan. Kirjautuneille (lohkoeditori, WooCommerce-nakymat) toiminta sailyy ennallaan.
 * Version: 1.1.0
 * Author: WebAula
 */

defined( 'ABSPATH' ) || exit;

/**
 * 0) XML-RPC: kova esto heti mu-plugin-vaiheessa.
 *
 * Ensisijainen esto on .htaccessissa (Files xmlrpc.php), jolloin PHP:ta ei ajeta
 * lainkaan. Tama on varmistus sen varalle etta .htaccess korvautuu.
 */
if ( isset( $_SERVER['SCRIPT_FILENAME'] ) && 'xmlrpc.php' === basename( $_SERVER['SCRIPT_FILENAME'] ) ) {
	header( 'HTTP/1.1 403 Forbidden' );
	header( 'Content-Type: text/plain; charset=utf-8' );
	exit( 'XML-RPC disabled.' );
}

/**
 * 1) /wp-json/wp/v2/users ja /wp-json/wp/v2/users/<id> vain kirjautuneille.
 *
 * /wp/v2/users/me jatetaan koskematta - se palauttaa ilman kirjautumista 401:n
 * eika listaa mitaan. Lohkoeditori ja WooCommerce toimivat normaalisti, koska
 * ne kutsuvat paatepistetta kirjautuneena.
 */
add_filter(
	'rest_endpoints',
	function ( $endpoints ) {
		if ( is_user_logged_in() ) {
			return $endpoints;
		}

		unset( $endpoints['/wp/v2/users'] );
		unset( $endpoints['/wp/v2/users/(?P<id>[\d]+)'] );

		return $endpoints;
	}
);

/**
 * 2) Estetaan ?author=N -uudelleenohjaus, joka paljastaa tunnuksen author-slugina.
 *
 * Prioriteetti 0, jotta tama ajetaan ennen WordPressin omaa redirect_canonicalia.
 */
add_action(
	'template_redirect',
	function () {
		if ( is_user_logged_in() ) {
			return;
		}

		if ( ! isset( $_GET['author'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}

		if ( ! is_numeric( wp_unslash( $_GET['author'] ) ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}

		wp_safe_redirect( home_url( '/' ), 301 );
		exit;
	},
	0
);

/**
 * 3) Poistetaan tunnuksen paljastava author_url oEmbed-vastauksesta.
 */
add_filter(
	'oembed_response_data',
	function ( $data ) {
		unset( $data['author_url'] );

		return $data;
	}
);

/**
 * 4) XML-RPC:n rajapinta, pingbackit ja niihin viittaavat vihjeet pois.
 *
 * Nama vaikuttavat myos silloin, jos xmlrpc.php ajettaisiin jotain muuta reittia:
 * yhtaan metodia ei ole tarjolla eika sivusto mainosta rajapintaa.
 */
add_filter( 'xmlrpc_enabled', '__return_false' );
add_filter( 'xmlrpc_methods', '__return_empty_array' );
add_filter( 'pings_open', '__return_false', 20 );

add_filter(
	'wp_headers',
	function ( $headers ) {
		unset( $headers['X-Pingback'] );

		return $headers;
	}
);

remove_action( 'wp_head', 'rsd_link' );
