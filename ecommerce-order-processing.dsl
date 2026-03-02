workspace "E-Commerce Order Processing System" "Event-Driven Architecture for Real-Time Order Processing" {

    model {
        # People
        customer = person "Customer" "A user who places orders on the e-commerce platform"
        
        # External Systems
        paymentGateway = softwareSystem "Payment Gateway" "Third-party payment processing service" "External System"
        shippingProvider = softwareSystem "Shipping Provider" "Third-party shipping and logistics service" "External System"
        emailService = softwareSystem "Email/SMS Service" "External notification delivery service" "External System"
        
        # Main Software System
        orderProcessingSystem = softwareSystem "Order Processing System" "Handles real-time order processing with event-driven architecture" {
            
            # Containers
            webApp = container "Web Application" "Provides e-commerce interface for customers" "React/Angular" "Web Browser"
            apiGateway = container "API Gateway" "Entry point for all client requests" "Kong/AWS API Gateway"
            
            orderService = container "Order Service" "Manages order lifecycle and coordinates order processing" "Java Spring Boot" {
                # Components
                orderController = component "Order Controller" "Handles order-related HTTP requests" "REST Controller"
                orderEventProducer = component "Order Event Producer" "Publishes order-related events" "Event Producer"
                orderEventConsumer = component "Order Event Consumer" "Consumes payment and inventory events" "Event Consumer"
                orderRepository = component "Order Repository" "Manages order data persistence" "JPA Repository"
            }
            
            inventoryService = container "Inventory Service" "Manages product inventory and stock levels" "Java Spring Boot" {
                # Components
                inventoryEventConsumer = component "Inventory Event Consumer" "Listens for Order Placed events" "Event Consumer"
                inventoryManager = component "Inventory Manager" "Updates stock levels" "Service Component"
                inventoryEventProducer = component "Inventory Event Producer" "Publishes Inventory Updated events" "Event Producer"
                inventoryRepository = component "Inventory Repository" "Manages inventory data" "JPA Repository"
            }
            
            paymentService = container "Payment Service" "Processes payments via third-party gateway" "Java Spring Boot" {
                # Components
                paymentEventConsumer = component "Payment Event Consumer" "Listens for Order Placed events" "Event Consumer"
                paymentProcessor = component "Payment Processor" "Processes payment transactions" "Service Component"
                paymentEventProducer = component "Payment Event Producer" "Publishes Payment Processed/Failed events" "Event Producer"
                paymentRepository = component "Payment Repository" "Stores payment records" "JPA Repository"
            }
            
            shippingService = container "Shipping Service" "Arranges shipping and generates tracking" "Java Spring Boot" {
                # Components
                shippingEventConsumer = component "Shipping Event Consumer" "Listens for Order Confirmed events" "Event Consumer"
                shippingScheduler = component "Shipping Scheduler" "Coordinates with shipping providers" "Service Component"
                shippingEventProducer = component "Shipping Event Producer" "Publishes Shipping Scheduled events" "Event Producer"
                shippingRepository = component "Shipping Repository" "Stores shipping details" "JPA Repository"
            }
            
            notificationService = container "Notification Service" "Sends notifications to customers" "Node.js" {
                # Components
                notificationEventConsumer = component "Notification Event Consumer" "Listens for all order-related events" "Event Consumer"
                notificationManager = component "Notification Manager" "Manages notification delivery" "Service Component"
                notificationEventProducer = component "Notification Event Producer" "Publishes Notification Sent events" "Event Producer"
            }
            
            eventBus = container "Event Bus (Message Broker)" "Routes events between services" "Apache Kafka/RabbitMQ" "Message Broker"
            eventStore = container "Event Store" "Stores events for auditing and replay" "EventStoreDB/Kafka" "Database"
            
            orderDatabase = container "Order Database" "Stores order information" "PostgreSQL" "Database"
            inventoryDatabase = container "Inventory Database" "Stores inventory data" "PostgreSQL" "Database"
            paymentDatabase = container "Payment Database" "Stores payment records" "PostgreSQL" "Database"
            shippingDatabase = container "Shipping Database" "Stores shipping details" "PostgreSQL" "Database"
        }
        
        # Context Level Relationships
        customer -> orderProcessingSystem "Places orders, views order status"
        orderProcessingSystem -> paymentGateway "Processes payments"
        orderProcessingSystem -> shippingProvider "Arranges shipping"
        orderProcessingSystem -> emailService "Sends notifications"
        
        # Container Level Relationships
        customer -> webApp "Places orders using" "HTTPS"
        webApp -> apiGateway "Makes API calls to" "HTTPS/REST"
        apiGateway -> orderService "Routes requests to" "HTTPS/REST"
        
        # Order Service relationships
        orderService -> eventBus "Publishes/Consumes events" "AMQP/Kafka Protocol"
        orderService -> orderDatabase "Reads from and writes to" "JDBC"
        
        # Inventory Service relationships
        inventoryService -> eventBus "Publishes/Consumes events" "AMQP/Kafka Protocol"
        inventoryService -> inventoryDatabase "Reads from and writes to" "JDBC"
        
        # Payment Service relationships
        paymentService -> eventBus "Publishes/Consumes events" "AMQP/Kafka Protocol"
        paymentService -> paymentGateway "Processes payments via" "HTTPS/REST"
        paymentService -> paymentDatabase "Reads from and writes to" "JDBC"
        
        # Shipping Service relationships
        shippingService -> eventBus "Publishes/Consumes events" "AMQP/Kafka Protocol"
        shippingService -> shippingProvider "Schedules shipping via" "HTTPS/REST"
        shippingService -> shippingDatabase "Reads from and writes to" "JDBC"
        
        # Notification Service relationships
        notificationService -> eventBus "Consumes events" "AMQP/Kafka Protocol"
        notificationService -> emailService "Sends notifications via" "HTTPS/SMTP"
        
        # Event Store relationships
        eventBus -> eventStore "Persists events to" "Kafka Protocol"
        
        # Component Level Relationships - Order Service
        apiGateway -> orderController "Makes API calls to" "HTTPS/REST"
        orderController -> orderEventProducer "Triggers event publishing"
        orderController -> orderRepository "Reads/writes order data"
        orderEventProducer -> eventBus "Publishes Order Placed, Order Confirmed events"
        orderEventConsumer -> eventBus "Subscribes to Payment Processed, Inventory Updated events"
        orderEventConsumer -> orderController "Notifies about event completion"
        orderRepository -> orderDatabase "Persists data to" "JDBC"
        
        # Component Level Relationships - Inventory Service
        inventoryEventConsumer -> eventBus "Subscribes to Order Placed events"
        inventoryEventConsumer -> inventoryManager "Triggers inventory update"
        inventoryManager -> inventoryRepository "Updates stock levels"
        inventoryManager -> inventoryEventProducer "Triggers event publishing"
        inventoryEventProducer -> eventBus "Publishes Inventory Updated events"
        inventoryRepository -> inventoryDatabase "Persists data to" "JDBC"
        
        # Component Level Relationships - Payment Service
        paymentEventConsumer -> eventBus "Subscribes to Order Placed events"
        paymentEventConsumer -> paymentProcessor "Triggers payment processing"
        paymentProcessor -> paymentGateway "Processes payment via" "HTTPS"
        paymentProcessor -> paymentRepository "Stores payment records"
        paymentProcessor -> paymentEventProducer "Triggers event publishing"
        paymentEventProducer -> eventBus "Publishes Payment Processed/Failed events"
        paymentRepository -> paymentDatabase "Persists data to" "JDBC"
        
        # Component Level Relationships - Shipping Service
        shippingEventConsumer -> eventBus "Subscribes to Order Confirmed events"
        shippingEventConsumer -> shippingScheduler "Triggers shipping scheduling"
        shippingScheduler -> shippingProvider "Arranges shipping via" "HTTPS"
        shippingScheduler -> shippingRepository "Stores shipping details"
        shippingScheduler -> shippingEventProducer "Triggers event publishing"
        shippingEventProducer -> eventBus "Publishes Shipping Scheduled events"
        shippingRepository -> shippingDatabase "Persists data to" "JDBC"
        
        # Component Level Relationships - Notification Service
        notificationEventConsumer -> eventBus "Subscribes to all order events"
        notificationEventConsumer -> notificationManager "Triggers notification sending"
        notificationManager -> emailService "Sends notifications via" "HTTPS/SMTP"
        notificationManager -> notificationEventProducer "Triggers event publishing"
        notificationEventProducer -> eventBus "Publishes Notification Sent events"
    }

    views {
        # Context Diagram
        systemContext orderProcessingSystem "SystemContext" {
            include *
            autoLayout lr
            description "System Context diagram for the E-Commerce Order Processing System"
        }
        
        # Container Diagram
        container orderProcessingSystem "Containers" {
            include *
            autoLayout lr
            description "Container diagram showing the high-level architecture of the Order Processing System"
        }
        
        # Component Diagram - Order Service
        component orderService "OrderServiceComponents" {
            include *
            autoLayout lr
            description "Component diagram for the Order Service"
        }
        
        # Component Diagram - Inventory Service
        component inventoryService "InventoryServiceComponents" {
            include *
            autoLayout lr
            description "Component diagram for the Inventory Service"
        }
        
        # Component Diagram - Payment Service
        component paymentService "PaymentServiceComponents" {
            include *
            autoLayout lr
            description "Component diagram for the Payment Service"
        }
        
        # Component Diagram - Shipping Service
        component shippingService "ShippingServiceComponents" {
            include *
            autoLayout lr
            description "Component diagram for the Shipping Service"
        }
        
        # Component Diagram - Notification Service
        component notificationService "NotificationServiceComponents" {
            include *
            autoLayout lr
            description "Component diagram for the Notification Service"
        }
        
        styles {
            element "Person" {
                shape Person
                background #08427b
                color #ffffff
            }
            element "External System" {
                background #999999
                color #ffffff
            }
            element "Software System" {
                background #1168bd
                color #ffffff
            }
            element "Container" {
                background #438dd5
                color #ffffff
            }
            element "Web Browser" {
                shape WebBrowser
            }
            element "Message Broker" {
                shape Pipe
            }
            element "Database" {
                shape Cylinder
            }
            element "Component" {
                background #85bbf0
                color #000000
            }
        }
    }
}
