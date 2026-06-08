<?php

namespace App\Providers;

use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register()
    {
        $this->app->booted(function () {
            $router = app('router');
            $this->removeTastyIgniterAssetsRoute($router);

            Route::match(['GET', 'HEAD'], '/admin/_assets/{asset}', function ($asset) {
                $ext = strtolower(pathinfo($asset, PATHINFO_EXTENSION));

                if (!in_array($ext, ['css', 'js'], true)) {
                    abort(404);
                }

                $paths = [
                    public_path('vendor/igniter'),
                    public_path('vendor/tastyigniter/core'),
                    base_path('vendor/tastyigniter/core/public'),
                ];

                $files = $ext === 'css'
                    ? ['css/vendor.css', 'css/app.css']
                    : ['js/vendor.js', 'js/app.js'];

                $content = '';
                foreach ($files as $file) {
                    foreach ($paths as $path) {
                        $fullPath = "$path/$file";
                        if (file_exists($fullPath)) {
                            $content .= file_get_contents($fullPath) . "\n";
                            break;
                        }
                    }
                }

                if ($ext === 'css') {
                    $content = preg_replace(
                        '/url\(\s*([\'"]?)\.\.\/(fonts|images)\//i',
                        'url($1/vendor/igniter/$2/',
                        $content
                    );
                }

                return response($content, 200, [
                    'Content-Type' => $ext === 'css' ? 'text/css' : 'application/javascript',
                ]);
            })->where('asset', '.*');
        });
    }

    public function boot() {}

    private function removeTastyIgniterAssetsRoute(Router $router): void
    {
        $collection = $router->getRoutes();

        $reflection = new \ReflectionClass($collection);
        $routesProp = $reflection->getProperty('routes');
        $routesProp->setAccessible(true);
        $allRoutes = $routesProp->getValue($collection);

        $targetName = 'igniter.admin.assets';
        $removed = false;

        foreach (['GET', 'HEAD'] as $method) {
            if (!isset($allRoutes[$method][''])) continue;
            foreach ($allRoutes[$method][''] as $key => $route) {
                if ($route->getName() === $targetName) {
                    unset($allRoutes[$method][''][$key]);
                    $removed = true;
                }
            }
            if ($removed) {
                $allRoutes[$method][''] = array_values($allRoutes[$method]['']);
            }
        }

        $routesProp->setValue($collection, $allRoutes);
    }
}
