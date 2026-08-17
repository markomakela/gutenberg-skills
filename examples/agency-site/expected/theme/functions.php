<?php
/**
 * Agency Site theme setup.
 *
 * @package agency-site
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once get_template_directory() . '/inc/enqueue.php';
require_once get_template_directory() . '/inc/menus.php';
require_once get_template_directory() . '/inc/cpt.php';

/**
 * Theme supports. Most block theme features come from theme.json, so this
 * stays short on purpose.
 */
function agency_site_setup() {
	add_theme_support( 'wp-block-styles' );
	add_theme_support( 'responsive-embeds' );
	add_theme_support( 'editor-styles' );
	add_theme_support( 'post-thumbnails' );
	load_theme_textdomain( 'agency-site', get_template_directory() . '/languages' );
}
add_action( 'after_setup_theme', 'agency_site_setup' );

/**
 * Register the block pattern category patterns/ files are filed under.
 *
 * The pattern files themselves are discovered by WordPress automatically from
 * the patterns/ directory, so nothing here needs updating when one is added.
 */
function agency_site_pattern_category() {
	register_block_pattern_category(
		'agency-site',
		array( 'label' => __( 'Agency Site', 'agency-site' ) )
	);
}
add_action( 'init', 'agency_site_pattern_category' );
