import Foundation
import XCTest

enum SnapshotError: Error, CustomDebugStringConvertible {
    case cannotDetectUser
    case cannotFindHomeDirectory
    case cannotFindSimulatorHomeDirectory
    case cannotAccessSimulatorHomeDirectory(String)
    case cannotRunOnPhysicalDevice

    var debugDescription: String {
        switch self {
        case .cannotDetectUser:
            return "Couldn't find Snapshot configuration files - can't detect current user "
        case .cannotFindHomeDirectory:
            return "Couldn't find Snapshot configuration files - can't detect home directory"
        case .cannotFindSimulatorHomeDirectory:
            return "Couldn't find simulator home directory. Please, check SIMULATOR_HOST_HOME env variable"
        case .cannotAccessSimulatorHomeDirectory(let simulatorHostHome):
            return "Can't prepare environment. Simulator home directory is inaccessible. Does \(simulatorHostHome) exist?"
        case .cannotRunOnPhysicalDevice:
            return "Can't use Snapshot on a physical device."
        }
    }
}

@objcMembers
open class Snapshot: NSObject {
    static var app: XCUIApplication?
    static var cacheDirectory: URL?
    static var screenshotsDirectory: URL? {
        return cacheDirectory?.appendingPathComponent("screenshots", isDirectory: true)
    }

    open class func setupSnapshot(_ app: XCUIApplication, waitForAnimations: Bool = true) {
        Snapshot.app = app
        Snapshot.waitForAnimations = waitForAnimations

        do {
            let cacheDir = try pathPrefix()
            Snapshot.cacheDirectory = cacheDir
            setLanguage(app)
            setLocale(app)
            setLaunchArguments(app)
            try createScreenshotsDirectory()
        } catch let error {
            NSLog(error.localizedDescription)
        }
    }

    class func setLanguage(_ app: XCUIApplication) {
        let path = Bundle.main.path(forResource: "SnapshotConfig", ofType: "plist")
        if let path = path {
            let config = NSDictionary(contentsOfFile: path)
            let languagesString = config?.object(forKey: "languages") as! String
            let languages = languagesString.components(separatedBy: ", ")

            if let app = app as? XCUIApplication {
                app.launchArguments += ["-AppleLanguages", "(\(languages.map { "\"\($0)\"" }.joined(separator: ", ")))"]
            }
        }
    }

    class func setLocale(_ app: XCUIApplication) {
        let path = Bundle.main.path(forResource: "SnapshotConfig", ofType: "plist")
        if let path = path {
            let config = NSDictionary(contentsOfFile: path)
            let localeString = config?.object(forKey: "locale") as! String

            if let app = app as? XCUIApplication {
                app.launchArguments += ["-AppleLocale", "\"\(localeString)\""]
            }
        }
    }

    class func setLaunchArguments(_ app: XCUIApplication) {
        let path = Bundle.main.path(forResource: "SnapshotConfig", ofType: "plist")
        if let path = path {
            let config = NSDictionary(contentsOfFile: path)
            let launchArgs = config?.object(forKey: "launch_arguments") as! [String]

            if let app = app as? XCUIApplication {
                app.launchArguments += launchArgs
            }
        }
    }

    open class func snapshot(_ name: String, timeWaitingForIdle timeout: TimeInterval = 20) {
        if timeout > 0 {
            waitForLoadingIndicatorToDisappear(within: timeout)
        }

        NSLog("snapshot: \(name)")

        if let app = app as? XCUIApplication {
            let screenshot = app.windows.firstMatch.screenshot()
            guard let simulator = ProcessInfo().environment["SIMULATOR_DEVICE_NAME"], let screenshotsDir = screenshotsDirectory else { return }
            let path = screenshotsDir.appendingPathComponent("\(simulator)-\(name).png")
            do {
                try screenshot.pngRepresentation.write(to: path)
            } catch let error {
                NSLog("Problem writing screenshot: \(name) to \(path)")
                NSLog(error.localizedDescription)
            }
        }
    }

    static var waitForAnimations = true
    static let timeOutDuration: TimeInterval = 30

    class func waitForLoadingIndicatorToDisappear(within timeout: TimeInterval) {
        if waitForAnimations {
            Thread.sleep(forTimeInterval: 1)
        }

        let networkLoadingIndicator = XCUIApplication().otherElements.deviceStatusBars.networkLoadingIndicators.element
        let networkLoadingIndicatorDisappeared = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: networkLoadingIndicator)
        _ = XCTWaiter.wait(for: [networkLoadingIndicatorDisappeared], timeout: timeout)
    }

    class func pathPrefix() throws -> URL? {
        let homeDir: URL
        // on OSX config is stored in /Users/<username>/Library
        // and on iOS/tvOS/WatchOS it's in simulator's home dir
        #if os(OSX)
        guard let user = ProcessInfo().environment["USER"] else {
            throw SnapshotError.cannotDetectUser
        }

        guard let usersDir = FileManager.default.urls(for: .userDirectory, in: .localDomainMask).first else {
            throw SnapshotError.cannotFindHomeDirectory
        }

        homeDir = usersDir.appendingPathComponent(user)
        #else
        #if arch(i386) || arch(x86_64)
        guard let simulatorHostHome = ProcessInfo().environment["SIMULATOR_HOST_HOME"] else {
            throw SnapshotError.cannotFindSimulatorHomeDirectory
        }
        guard let homeDirUrl = URL(string: simulatorHostHome) else {
            throw SnapshotError.cannotAccessSimulatorHomeDirectory(simulatorHostHome)
        }
        homeDir = URL(fileURLWithPath: homeDirUrl.path)
        #else
        throw SnapshotError.cannotRunOnPhysicalDevice
        #endif
        #endif
        return homeDir.appendingPathComponent("Library/Caches/tools.fastlane")
    }

    class func createScreenshotsDirectory() throws {
        guard let screenshotsDir = screenshotsDirectory else { return }
        if !FileManager.default.fileExists(atPath: screenshotsDir.path) {
            try FileManager.default.createDirectory(at: screenshotsDir, withIntermediateDirectories: true)
        }
    }
}

extension XCUIElement {
    var isLoadingIndicator: Bool {
        let whiteListedLoaders = ["GeofenceLocationTrackingOn", "StandardLocationTrackingOn"]
        if whiteListedLoaders.contains(self.identifier) {
            return false
        }
        return self.frame.size == CGSize(width: 10, height: 20)
    }
}

extension XCUIElementQuery {
    var networkLoadingIndicators: XCUIElementQuery {
        let isNetworkLoadingIndicator = NSPredicate { (evaluatedObject, _) in
            guard let element = evaluatedObject as? XCUIElementAttributes else { return false }

            return element.isLoadingIndicator
        }

        return self.containing(isNetworkLoadingIndicator)
    }

    var deviceStatusBars: XCUIElementQuery {
        return self.matching(identifier: "StatusBar")
    }
}

extension XCUIApplication {
    func scrollToElement(element: XCUIElement) {
        while !element.visible() {
            swipeUp()
        }
    }
}

extension XCUIElement {
    func visible() -> Bool {
        guard self.exists && !self.frame.isEmpty else { return false }
        return XCUIApplication().windows.element(boundBy: 0).frame.contains(self.frame)
    }
} 