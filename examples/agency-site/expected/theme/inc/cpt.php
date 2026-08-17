<?php
/**
 * Custom post types.
 *
 * @package agency-site
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * No custom post types yet. Register them here rather than in a plugin only if
 * they are genuinely part of the theme. Content that must survive a theme
 * change belongs in a plugin.
 *
 * Example:
 *
 * register_post_type(
 *     'service',
 *     array(
 *         'label'        => __( 'Services', 'agency-site' ),
 *         'public'       => true,
 *         'has_archive'  => true,
 *         'show_in_rest' => true,
 *         'supports'     => array( 'title', 'editor', 'thumbnail', 'excerpt' ),
 *     )
 * );
 */
function agency_site_post_types() {
	// Intentionally empty.
}
add_action( 'init', 'agency_site_post_types' );
