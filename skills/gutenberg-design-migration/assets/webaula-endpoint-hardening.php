<?php
/**
 * Plugin Name: WebAula - REST- ja XML-RPC-suojaus
 * Description: Estaa kayttajatunnusten listaamisen REST API:n users-paatepisteesta, ?author=N-kyselysta ja oEmbed-vastauksesta kirjautumattomilta. Sulkee lisaksi XML-RPC:n kokonaan, yleistaa kirjautumisen virheilmoituksen, poistaa sovellussalasanat ja tiedostoeditorin. Kirjautuneille (lohkoeditori, WooCommerce-nakymat) toiminta sailyy ennallaan.
 * Version: 1.2.0
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

/**
 * 5) Kirjautumisen virheilmoitus ei kerro onko tunnus olemassa.
 *
 * WordPress sanoo "Tuntematon kayttajatunnus" vs "Salasana kayttajalle X on
 * vaara", eli lomake vuotaa saman tiedon jonka kohdat 1-3 sulkivat. Suodatin
 * on authenticate eika login_errors, koska WooCommercen Oma tili -lomake ei
 * kayta kirjautumissivua lainkaan mutta kulkee saman authenticate-ketjun
 * lapi. Prioriteetti 40 ajaa coren omien tarkistusten jalkeen.
 */
add_filter(
	'authenticate',
	function ( $user ) {
		if ( ! is_wp_error( $user ) ) {
			return $user;
		}

		$leaky = array( 'invalid_username', 'invalid_email', 'incorrect_password' );

		if ( ! array_intersect( $leaky, $user->get_error_codes() ) ) {
			return $user;
		}

		return new WP_Error(
			'invalid_login',
			__( '<strong>Virhe:</strong> Kirjautuminen epaonnistui.' )
		);
	},
	40
);

/**
 * 6) Sovellussalasanat pois.
 *
 * Paalla oletuksena WP 5.6:sta lahtien ja ne OHITTAVAT kaksivaiheisen
 * tunnistuksen, joten 2FA:n kayttoonotto ei kata kaikkea niin kauan kuin nama
 * ovat kaytettavissa. Poista tama rivi jos jokin integraatio kayttaa niita.
 */
add_filter( 'wp_is_application_passwords_available', '__return_false' );

/**
 * 7) Tiedostoeditori pois wp-administa.
 *
 * Ilman tata kaapattu yllapitajaistunto on suora koodin suoritus eika pelkka
 * sisallon muokkaus. Vakiopaikka on wp-config.php, mutta vakio tarkistetaan
 * vasta map_meta_cap()issa eli hyvin mu-plugin-vaiheen jalkeen, joten se
 * toimii myos taalta ja koko kovennus pysyy yhdessa tiedostossa.
 */
if ( ! defined( 'DISALLOW_FILE_EDIT' ) ) {
	define( 'DISALLOW_FILE_EDIT', true );
}
