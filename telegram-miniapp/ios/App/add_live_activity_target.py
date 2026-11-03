#!/usr/bin/env python3
"""
Añade el target "RabbittyOrderWidget" (Widget Extension con ActivityKit) al
App.xcodeproj de forma idempotente.

- Copia de seguridad del project.pbxproj antes de tocar nada.
- Inserta los objetos mínimos: target, fases, configuraciones, dependencia,
  fase de embed, referencias de archivos y grupos.
- No duplica nada si ya existe (se puede re-ejecutar).
"""

import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PBX = os.path.join(ROOT, "App.xcodeproj", "project.pbxproj")
BACKUP = PBX + ".bak-live-activity"

# ── IDs (24 hex) ──────────────────────────────────────────────────────────────
ID = {
    "target":         "AB0000000000000000000001",
    "product":        "AB0000000000000000000002",
    "group":          "AB0000000000000000000003",
    "ref_attrs":      "AB0000000000000000000004",
    "ref_bundle":     "AB0000000000000000000005",
    "ref_live":       "AB0000000000000000000006",
    "ref_plist":      "AB0000000000000000000007",
    "phase_sources":  "AB0000000000000000000008",
    "phase_frameworks": "AB0000000000000000000009",
    "phase_resources": "AB000000000000000000000A",
    "bf_attrs_app":   "AB000000000000000000000B",
    "bf_attrs_ext":   "AB000000000000000000000C",
    "bf_bundle_ext":  "AB000000000000000000000D",
    "bf_live_ext":    "AB000000000000000000000E",
    "bf_plugin_app":  "AB000000000000000000000F",
    "ref_plugin":     "AB0000000000000000000010",
    "cfg_list":       "AB0000000000000000000011",
    "cfg_debug":      "AB0000000000000000000012",
    "cfg_release":    "AB0000000000000000000013",
    "dep":            "AB0000000000000000000014",
    "proxy":          "AB0000000000000000000015",
    "phase_embed":    "AB0000000000000000000016",
    "bf_embed":       "AB0000000000000000000017",
}

APP_TARGET = "504EC3031FED79650016851F"
PROJECT = "504EC2FC1FED79650016851F"
MAIN_GROUP = "504EC2FB1FED79650016851F"
PRODUCTS_GROUP = "504EC3051FED79650016851F"
APP_GROUP = "504EC3061FED79650016851F"


def main() -> int:
    src = open(PBX, encoding="utf-8").read()
    if "RabbittyOrderWidget" in src and ID["target"] in src:
        print("Ya está aplicado — nada que hacer.")
        return 0

    shutil.copy2(PBX, BACKUP)
    out = src

    # 1) PBXBuildFile
    build_files = f"""		{ID['bf_attrs_app']} /* RabbittyOrderActivityAttributes.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {ID['ref_attrs']} /* RabbittyOrderActivityAttributes.swift */; }};
		{ID['bf_attrs_ext']} /* RabbittyOrderActivityAttributes.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {ID['ref_attrs']} /* RabbittyOrderActivityAttributes.swift */; }};
		{ID['bf_bundle_ext']} /* RabbittyOrderWidgetBundle.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {ID['ref_bundle']} /* RabbittyOrderWidgetBundle.swift */; }};
		{ID['bf_live_ext']} /* RabbittyOrderLiveActivity.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {ID['ref_live']} /* RabbittyOrderLiveActivity.swift */; }};
		{ID['bf_plugin_app']} /* RabbittyLiveActivityPlugin.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {ID['ref_plugin']} /* RabbittyLiveActivityPlugin.swift */; }};
		{ID['bf_embed']} /* RabbittyOrderWidget.appex in Embed Foundation Extensions */ = {{isa = PBXBuildFile; fileRef = {ID['product']} /* RabbittyOrderWidget.appex */; settings = {{ATTRIBUTES = (RemoveHeadersOnCopy, ); }}; }};
"""
    out = out.replace("/* End PBXBuildFile section */", build_files + "/* End PBXBuildFile section */", 1)

    # 2) PBXContainerItemProxy (nueva sección) — va antes de PBXCopyFilesBuildPhase alfabéticamente
    proxy = f"""/* Begin PBXContainerItemProxy section */
		{ID['proxy']} /* PBXContainerItemProxy */ = {{
			isa = PBXContainerItemProxy;
			containerPortal = {PROJECT} /* Project object */;
			proxyType = 1;
			remoteGlobalIDString = {ID['target']};
			remoteInfo = RabbittyOrderWidget;
		}};
/* End PBXContainerItemProxy section */

"""
    out = out.replace("/* Begin PBXFrameworksBuildPhase section */", proxy + "/* Begin PBXFrameworksBuildPhase section */", 1)

    # 3) PBXCopyFilesBuildPhase (embed app extensions en la app)
    embed = f"""/* Begin PBXCopyFilesBuildPhase section */
		{ID['phase_embed']} /* Embed Foundation Extensions */ = {{
			isa = PBXCopyFilesBuildPhase;
			buildActionMask = 2147483647;
			dstPath = "";
			dstSubfolderSpec = 13;
			files = (
				{ID['bf_embed']} /* RabbittyOrderWidget.appex in Embed Foundation Extensions */,
			);
			name = "Embed Foundation Extensions";
			runOnlyForDeploymentPostprocessing = 0;
		}};
/* End PBXCopyFilesBuildPhase section */

"""
    out = out.replace("/* Begin PBXFileReference section */", embed + "/* Begin PBXFileReference section */", 1)

    # 4) PBXFileReference
    refs = f"""		{ID['product']} /* RabbittyOrderWidget.appex */ = {{isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; includeInIndex = 0; path = RabbittyOrderWidget.appex; sourceTree = BUILT_PRODUCTS_DIR; }};
		{ID['ref_attrs']} /* RabbittyOrderActivityAttributes.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RabbittyOrderActivityAttributes.swift; sourceTree = "<group>"; }};
		{ID['ref_bundle']} /* RabbittyOrderWidgetBundle.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RabbittyOrderWidgetBundle.swift; sourceTree = "<group>"; }};
		{ID['ref_live']} /* RabbittyOrderLiveActivity.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RabbittyOrderLiveActivity.swift; sourceTree = "<group>"; }};
		{ID['ref_plist']} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; }};
		{ID['ref_plugin']} /* RabbittyLiveActivityPlugin.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RabbittyLiveActivityPlugin.swift; sourceTree = "<group>"; }};
"""
    out = out.replace("/* End PBXFileReference section */", refs + "/* End PBXFileReference section */", 1)

    # 5) Frameworks phase del widget
    frameworks = f"""		{ID['phase_frameworks']} /* Frameworks */ = {{
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		}};
"""
    out = out.replace("/* End PBXFrameworksBuildPhase section */", frameworks + "/* End PBXFrameworksBuildPhase section */", 1)

    # 6) Grupos
    out = out.replace(
        f"""				504EC3051FED79650016851F /* Products */,
			);
			sourceTree = "<group>";""",
        f"""				504EC3051FED79650016851F /* Products */,
				{ID['group']} /* RabbittyOrderWidget */,
			);
			sourceTree = "<group>";""",
        1,
    )
    out = out.replace(
        f"""				504EC3041FED79650016851F /* Rabbitty.app */,
			);
			name = Products;""",
        f"""				504EC3041FED79650016851F /* Rabbitty.app */,
				{ID['product']} /* RabbittyOrderWidget.appex */,
			);
			name = Products;""",
        1,
    )
    # El grupo nuevo: se inserta justo antes de "End PBXGroup section"
    new_group = f"""		{ID['group']} /* RabbittyOrderWidget */ = {{
			isa = PBXGroup;
			children = (
				{ID['ref_bundle']} /* RabbittyOrderWidgetBundle.swift */,
				{ID['ref_live']} /* RabbittyOrderLiveActivity.swift */,
				{ID['ref_attrs']} /* RabbittyOrderActivityAttributes.swift */,
				{ID['ref_plist']} /* Info.plist */,
			);
			path = RabbittyOrderWidget;
			sourceTree = "<group>";
		}};
"""
    out = out.replace("/* End PBXGroup section */", new_group + "/* End PBXGroup section */", 1)

    # Plugin dentro del grupo App
    out = out.replace(
        f"""				9582B68F2FE994A10072D4E8 /* RabbittyMapPlugin.swift */,
				50379B222058CBB4000EE86E /* capacitor.config.json */,""",
        f"""				9582B68F2FE994A10072D4E8 /* RabbittyMapPlugin.swift */,
				{ID['ref_plugin']} /* RabbittyLiveActivityPlugin.swift */,
				50379B222058CBB4000EE86E /* capacitor.config.json */,""",
        1,
    )

    # 7) Native target del widget + dependencia en App
    target = f"""		{ID['target']} /* RabbittyOrderWidget */ = {{
			isa = PBXNativeTarget;
			buildConfigurationList = {ID['cfg_list']} /* Build configuration list for PBXNativeTarget "RabbittyOrderWidget" */;
			buildPhases = (
				{ID['phase_sources']} /* Sources */,
				{ID['phase_frameworks']} /* Frameworks */,
				{ID['phase_resources']} /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
			);
			name = RabbittyOrderWidget;
			productName = RabbittyOrderWidget;
			productReference = {ID['product']} /* RabbittyOrderWidget.appex */;
			productType = "com.apple.product-type.app-extension";
		}};
"""
    out = out.replace("/* End PBXNativeTarget section */", target + "/* End PBXNativeTarget section */", 1)

    # App: dependencia + embed phase en buildPhases + dependencies
    out = out.replace(
        f"""			buildPhases = (
				504EC3001FED79650016851F /* Sources */,
				504EC3011FED79650016851F /* Frameworks */,
				504EC3021FED79650016851F /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
			);""",
        f"""			buildPhases = (
				504EC3001FED79650016851F /* Sources */,
				504EC3011FED79650016851F /* Frameworks */,
				504EC3021FED79650016851F /* Resources */,
				{ID['phase_embed']} /* Embed Foundation Extensions */,
			);
			buildRules = (
			);
			dependencies = (
				{ID['dep']} /* PBXTargetDependency */,
			);""",
        1,
    )

    # 8) PBXProject: targets + TargetAttributes
    out = out.replace(
        f"""			targets = (
				504EC3031FED79650016851F /* App */,
			);""",
        f"""			targets = (
				504EC3031FED79650016851F /* App */,
				{ID['target']} /* RabbittyOrderWidget */,
			);""",
        1,
    )

    # 9) Resources phase del widget
    resources = f"""		{ID['phase_resources']} /* Resources */ = {{
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		}};
"""
    out = out.replace("/* End PBXResourcesBuildPhase section */", resources + "/* End PBXResourcesBuildPhase section */", 1)

    # 10) Sources phase del widget + plugin/attrs en la app
    sources = f"""		{ID['phase_sources']} /* Sources */ = {{
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				{ID['bf_bundle_ext']} /* RabbittyOrderWidgetBundle.swift in Sources */,
				{ID['bf_live_ext']} /* RabbittyOrderLiveActivity.swift in Sources */,
				{ID['bf_attrs_ext']} /* RabbittyOrderActivityAttributes.swift in Sources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		}};
"""
    out = out.replace("/* End PBXSourcesBuildPhase section */", sources + "/* End PBXSourcesBuildPhase section */", 1)

    out = out.replace(
        f"""				9582B6912FE994A10072D4E8 /* RabbittyMapPlugin.swift in Sources */,""",
        f"""				9582B6912FE994A10072D4E8 /* RabbittyMapPlugin.swift in Sources */,
				{ID['bf_plugin_app']} /* RabbittyLiveActivityPlugin.swift in Sources */,
				{ID['bf_attrs_app']} /* RabbittyOrderActivityAttributes.swift in Sources */,""",
        1,
    )

    # 11) Target dependency
    dep = f"""/* Begin PBXTargetDependency section */
		{ID['dep']} /* PBXTargetDependency */ = {{
			isa = PBXTargetDependency;
			target = {ID['target']} /* RabbittyOrderWidget */;
			targetProxy = {ID['proxy']} /* PBXContainerItemProxy */;
		}};
/* End PBXTargetDependency section */

"""
    out = out.replace("/* Begin XCBuildConfiguration section */", dep + "/* Begin XCBuildConfiguration section */", 1)

    # 12) Build configurations del widget
    settings = """				APPLICATION_EXTENSION_API_ONLY = YES;
				CLANG_ENABLE_MODULES = YES;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 12;
				DEVELOPMENT_TEAM = FW97275K5X;
				GENERATE_INFOPLIST_FILE = NO;
				INFOPLIST_FILE = RabbittyOrderWidget/Info.plist;
				IPHONEOS_DEPLOYMENT_TARGET = 17.0;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
					"@executable_path/../../Frameworks",
				);
				MARKETING_VERSION = 2.4;
				PRODUCT_BUNDLE_IDENTIFIER = com.rabbitty.app.RabbittyOrderWidget;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SKIP_INSTALL = YES;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
"""
    cfgs = f"""		{ID['cfg_debug']} /* Debug */ = {{
			isa = XCBuildConfiguration;
			buildSettings = {{
{settings}			}};
			name = Debug;
		}};
		{ID['cfg_release']} /* Release */ = {{
			isa = XCBuildConfiguration;
			buildSettings = {{
{settings}			}};
			name = Release;
		}};
"""
    out = out.replace("/* End XCBuildConfiguration section */", cfgs + "/* End XCBuildConfiguration section */", 1)

    # 13) Configuration list
    cfg_list = f"""		{ID['cfg_list']} /* Build configuration list for PBXNativeTarget "RabbittyOrderWidget" */ = {{
			isa = XCConfigurationList;
			buildConfigurations = (
				{ID['cfg_debug']} /* Debug */,
				{ID['cfg_release']} /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		}};
"""
    out = out.replace("/* End XCConfigurationList section */", cfg_list + "/* End XCConfigurationList section */", 1)

    open(PBX, "w", encoding="utf-8").write(out)
    print("OK — target RabbittyOrderWidget añadido. Backup:", os.path.basename(BACKUP))
    return 0


if __name__ == "__main__":
    sys.exit(main())
