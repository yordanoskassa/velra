import XCTest

class HeadlineDecoderUITests: XCTestCase {
    
    override func setUp() {
        super.setUp()
        
        // In UI tests it's important to set the initial state - such as interface orientation - required for your tests before they run.
        // The setUp method is a good place to do this.
        
        let app = XCUIApplication()
        setupSnapshot(app)
        app.launch()
        
        // Handle any initial screens like login if needed
        // For example, if you need to log in first:
        // login(app)
    }
    
    override func tearDown() {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
        super.tearDown()
    }
    
    func testTakeScreenshots() {
        let app = XCUIApplication()
        
        // 1. Welcome Screen
        snapshot("01_Welcome_Screen")
        
        // 2. Login Screen (tap on Login button)
        app.buttons["Log In"].tap()
        snapshot("02_Login_Screen")
        
        // Go back to welcome screen
        app.buttons.element(boundBy: 0).tap() // Back button
        
        // 3. Registration Screen (tap on Sign Up button)
        app.buttons["Sign Up"].tap()
        snapshot("03_Registration_Screen")
        
        // Go back to welcome screen and proceed with login
        app.buttons.element(boundBy: 0).tap() // Back button
        app.buttons["Log In"].tap()
        
        // 4. Enter email and continue
        let emailTextField = app.textFields.element(boundBy: 0)
        emailTextField.tap()
        emailTextField.typeText("demo@example.com")
        app.buttons["Continue"].tap()
        
        // 5. Enter password and login
        let passwordField = app.secureTextFields.element(boundBy: 0)
        passwordField.tap()
        passwordField.typeText("password123")
        app.buttons["Log In"].tap()
        
        // Wait for the main screen to load
        sleep(2)
        
        // 6. News Feed Screen
        snapshot("04_News_Feed")
        
        // 7. Article Details (tap on first article)
        if app.cells.count > 0 {
            app.cells.element(boundBy: 0).tap()
            sleep(1)
            snapshot("05_Article_Details")
            
            // Go back to news feed
            app.navigationBars.buttons.element(boundBy: 0).tap()
        }
        
        // 8. Profile Screen (if available)
        if app.tabBars.buttons.count > 1 {
            app.tabBars.buttons.element(boundBy: 1).tap()
            snapshot("06_Profile_Screen")
        }
    }
    
    // Helper function to login if needed
    func login(_ app: XCUIApplication) {
        // Implement login logic here if needed
    }
} 