<?php

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Artisan;

Route::get('/install-db', function () {
    $result = [];
    
    try {
        Artisan::call('cache:clear');
        Artisan::call('view:clear');
        $result[] = '=== Caches cleared ===';
        
        // 1) Publicar assets vendor
        Artisan::call('vendor:publish --all --force');
        $result[] = '=== vendor:publish --all ===';
        $result[] = Artisan::output();
        
        // 2) Publicar vendor de themes  
        Artisan::call('igniter:theme-vendor-publish');
        $result[] = '=== theme-vendor-publish ===';
        $result[] = Artisan::output();
        
        // 3) Copiar assets core a public
        $corePublic = base_path('vendor/tastyigniter/core/public');
        $targetDir = public_path('vendor/tastyigniter/core');
        if (is_dir($corePublic)) {
            app('files')->copyDirectory($corePublic, $targetDir);
            $result[] = '=== Copied core public assets to public/vendor/tastyigniter/core ===';
        }
        
        // 4) Ver assets copiados
        $result[] = '=== public/vendor contents ===';
        $vendorPub = public_path('vendor');
        if (is_dir($vendorPub)) {
            $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($vendorPub, RecursiveDirectoryIterator::SKIP_DOTS));
            $count = 0;
            foreach ($it as $file) {
                if ($count++ > 20) { $result[] = '... (truncated)'; break; }
                $result[] = str_replace(public_path(), '', $file->getPathname());
            }
        }
        
        return '<pre>' . e(implode("\n", $result)) . '</pre>';
    } catch (\Exception $e) {
        return '<pre>❌ Error: ' . e($e->getMessage()) . "\n" . e($e->getTraceAsString()) . '</pre>';
    }
});

Route::get('/debug-logs', function () {
    $logFile = storage_path('logs/laravel.log');
    if (!file_exists($logFile)) {
        // Try daily logs
        $logDir = storage_path('logs');
        $files = glob($logDir . '/*.log');
        if (empty($files)) {
            return 'No logs found in ' . $logDir;
        }
        // Sort by mtime, newest first
        usort($files, function($a, $b) {
            return filemtime($b) - filemtime($a);
        });
        $logFile = $files[0];
    }
    $size = filesize($logFile);
    $maxBytes = 50000;
    $contents = $size > $maxBytes 
        ? '[TRUNCATED] Last ' . $maxBytes . ' of ' . $size . " bytes:\n" . file_get_contents($logFile, false, null, max(0, $size - $maxBytes))
        : file_get_contents($logFile);
    return '<pre>' . e($contents) . '</pre>';
});

Route::get('/debug-env', function () {
    return response()->json([
        'app_debug' => env('APP_DEBUG'),
        'app_env' => env('APP_ENV'),
        'app_key_set' => !empty(env('APP_KEY')),
        'php_version' => PHP_VERSION,
        'extensions' => get_loaded_extensions(),
        'storage_writable' => is_writable(storage_path()),
    ]);
});

Route::get('/debug-assets', function () {
    $files = [];
    $publicPath = public_path();
    $vendorPath = base_path('vendor');
    
    // Check if core package has admin assets or public dir
    $corePath = $vendorPath . '/tastyigniter/core';
    $files['core_public'] = [];
    $corePublic = $corePath . '/public';
    if (is_dir($corePublic)) {
        $rdi = new RecursiveDirectoryIterator($corePublic, RecursiveDirectoryIterator::SKIP_DOTS);
        $it = new RecursiveIteratorIterator($rdi);
        foreach ($it as $file) {
            $files['core_public'][] = str_replace($corePath, '', $file->getPathname());
        }
    } else {
        $files['core_public'] = 'NO_PUBLIC_DIR';
        // List core root dir
        if (is_dir($corePath)) {
            foreach (scandir($corePath) as $item) {
                if ($item[0] === '.') continue;
                $files['core_root'][$item] = is_dir($corePath.'/'.$item) ? '(dir)' : '(file)';
            }
        }
    }
    
    // Check the admin module assets
    $adminAssetsPath = $corePath . '/src/Admin/Assets';
    $files['admin_assets'] = [];
    if (is_dir($adminAssetsPath)) {
        $rdi = new RecursiveDirectoryIterator($adminAssetsPath, RecursiveDirectoryIterator::SKIP_DOTS);
        $it = new RecursiveIteratorIterator($rdi);
        foreach ($it as $file) {
            $files['admin_assets'][] = str_replace($corePath, '', $file->getPathname());
        }
    } else {
        $files['admin_assets'] = 'NO_ADMIN_ASSETS_DIR';
    }
    
    // Check the admin controllers for Assets class
    $adminSrcPath = $corePath . '/src/Admin';
    $files['admin_src'] = [];
    if (is_dir($adminSrcPath)) {
        foreach (scandir($adminSrcPath) as $item) {
            if ($item[0] === '.') continue;
            $files['admin_src'][$item] = is_dir($adminSrcPath.'/'.$item) ? '(dir)' : '(file)';
        }
    }
    
    return response()->json($files, 200, [
        'Content-Type' => 'application/json; charset=utf-8',
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
});
