<?php
/**
 * Navigation menus.
 *
 * @package agency-site
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Block themes use the Navigation block, which stores its own menu. This
 * registration exists for classic menu locations that plugins still expect.
 */
function agency_site_menus() {
	register_nav_menus(
		array(
			'primary' => __( 'Primary', 'agency-site' ),
			'footer'  => __( 'Footer', 'agency-site' ),
		)
	);
}
add_action( 'init', 'agency_site_menus' );
