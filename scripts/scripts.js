$(document).ready(function() {
    // Check for saved dark/light theme preference
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    // Reset view
    $('#viewChart').prop('checked', true);
    $('#chartView').addClass('active');
    $('#summaryView').removeClass('active');
    $('#goalsView').removeClass('active');

    // Handle dark mode toggle
    $('#darkModeToggle').on('click', function() {
        const currentTheme = $('html').attr('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });

    // Handle dashboard data save
    $('#saveDataBtn').on('click', async function() {

        const confirmed = await showConfirmation(
            'Save Progress',
            `Would you like to save your current progress?`
        );

        if (confirmed) {
            const dashboardData = {
                financialItems: JSON.parse(localStorage.getItem('financialItems') || '[]'),
                financialGoals: JSON.parse(localStorage.getItem('financialGoals') || '[]'),
                financialMilestones: JSON.parse(localStorage.getItem('financialMilestones') || '[]'),
                itemsOrder: JSON.parse(localStorage.getItem('financialItemsOrder') || '[]'),
                visibleMetrics: JSON.parse(localStorage.getItem('visibleMetrics') || '[]'),
                theme: localStorage.getItem('theme') || 'light',
                guidedSetupDone: localStorage.getItem('guidedSetupDone') || 'false',
                dontShowGuidedSetup: localStorage.getItem('dontShowGuidedSetup') || 'false'
            };
    
            const dataStr = JSON.stringify(dashboardData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `financial-dashboard-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            
            URL.revokeObjectURL(url);
            document.body.removeChild(link);
            
            window.financialItemsManager.showToast('Dashboard data saved successfully', 'success');
        }
    });

    // Handle dashboard data upload
    $('#uploadDataBtn').on('click', async function() {
        const confirmed = await showConfirmation(
            'Upload Saved Progress',
            `Uploading a new financial journey will overwrite any currently saved data. Do you want to proceed?`
        );
        if (confirmed) {
            $('#dataFileInput').click();
        }
    });

    $('#dataFileInput').on('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                // Validate data structure
                const requiredKeys = [
                    'financialItems',
                    'financialGoals',
                    'financialMilestones',
                    'itemsOrder',
                    'visibleMetrics',
                    'theme',
                    'guidedSetupDone',
                    'dontShowGuidedSetup'
                ];
                const hasAllKeys = requiredKeys.every(key => key in data);
                
                if (!hasAllKeys) {
                    throw new Error('Invalid dashboard data file');
                }

                // Clear any existing saved data
                localStorage.removeItem('financialItems');
                localStorage.removeItem('financialItemsOrder');
                localStorage.removeItem('financialGoals');
                localStorage.removeItem('financialMilestones');
                localStorage.removeItem('visibleMetrics');
                localStorage.removeItem('theme');
                localStorage.removeItem('guidedSetupDone');
                localStorage.removeItem('dontShowGuidedSetup');

                // Update localStorage with new data
                localStorage.setItem('financialItems', JSON.stringify(data.financialItems));
                localStorage.setItem('financialGoals', JSON.stringify(data.financialGoals));
                localStorage.setItem('financialMilestones', JSON.stringify(data.financialMilestones));
                localStorage.setItem('financialItemsOrder', JSON.stringify(data.itemsOrder));
                localStorage.setItem('visibleMetrics', JSON.stringify(data.visibleMetrics));
                localStorage.setItem('guidedSetupDone', data.guidedSetupDone);
                localStorage.setItem('dontShowGuidedSetup', data.dontShowGuidedSetup);

                // Initialize Managers
                (async () => await initializeManagers())();

                // Update theme
                setTheme(data.theme);

                financialItemsManager.showToast('Dashboard data loaded successfully', 'success');
                
            } catch (error) {
                console.error('Error loading dashboard data:', error);
                window.financialItemsManager.showToast('Error loading dashboard data. Please check the file format.', 'error');
            }
        };

        reader.readAsText(file);
        this.value = ''; // Reset file input
    });

    // Handle dashboard data reset
    $('#resetDataButton').on('click', async function() {
        const confirmed = await showConfirmation(
            'Reset Dashboard',
            `Resetting the dashboard will erase current data and preferences. Any unsaved changes will be lost. Do you want to proceed?`
        );
        if (confirmed) {
            resetAllData();
        }
    });

    // Handle tab navigation
    $('.nav-link').on('click', function() {
        $('.nav-link').removeClass('active');
        $(this).addClass('active');
    });

    // Show expanded sidebar on larger screens
    if ($(window).width() > 768) {
        $('#controlsCollapse').addClass('show');
    }

    // Handle display options dropdown menu
    $('.sidebar .dropdown-item').on('click', function() {
        const selectedText = $(this).text();
        $(this).closest('.dropdown').find('.dropdown-toggle').text(selectedText);
    });

    // In the sortable initialization, modify the update function:
    $("#financialItemsList").sortable({
        items: ".financial-item",
        handle: ".financial-item-header",
        placeholder: "financial-item ui-sortable-placeholder",
        tolerance: "pointer",
        update: function(event, ui) {
            // Get new order of item IDs and ensure they're stored as strings
            const newOrder = $("#financialItemsList .financial-item").map(function() {
                return String($(this).data("item-id"));  // Explicitly convert to string
            }).get();
            
            // Save order to localStorage
            localStorage.setItem('financialItemsOrder', JSON.stringify(newOrder));
            
            // Reorder items array to match new order
            financialItemsManager.items.sort((a, b) => {
                const aIndex = newOrder.indexOf(String(a.id));
                const bIndex = newOrder.indexOf(String(b.id));
                return aIndex - bIndex;
            });
            
            financialItemsManager.saveToLocalStorage();
            
            if (window.chartManager) {
                chartManager.updateChart();
            }
        }
    });
    
    // Handle view type changes
    $('input[name="viewtype"]').on('change', function(e) {
        const selectedView = e.target.id.replace('view', '').toLowerCase();
                
        // Hide all views and show selected
        $('.view-content').removeClass('active');
        if (selectedView === 'chart') {
            $('#chartView').addClass('active');
            // Ensure chart is properly sized after becoming visible
            if (window.chartManager && window.chartManager.chart) {
                window.chartManager.chart.resize();
            }
        } else if (selectedView === 'summary') {
            $('#summaryView').addClass('active');
        } else if (selectedView === 'goals') {
            $('#goalsView').addClass('active');
            // Update goal progress when view is shown
            goalManager.updateGoalProgress();
        }
    });

    // When financial items are updated, update all goal progress
    $(document).on('financialItemsUpdated', function() {
        goalManager.goals.forEach(goal => {
            goalManager.updateGoalProgress(goal.id);
        });
        goalManager.renderGoals();
    });  

    // Global modal focus management
    $('.modal').off('hide.bs.modal').on('hide.bs.modal', function() {
        console.log("calling global hide handler for modal: ", $(this));

        // Focus on safe element
        $('body').focus();

        // Blur any focused buttons in the modal
        $(this).find(':focus').blur();

        $(this).removeClass('show').attr('aria-hidden', 'true');
        $('.modal-backdrop').remove();
                        
        // Reset body styles
        $('body').removeClass('modal-open')
            .css({
                'overflow': '',
                'padding-right': ''
            })
            .removeAttr('data-bs-padding-right');
        console.log("Focused element: ", document.activeElement);
    });

    // Register plugins
    Chart.register(ChartZoom);
    Chart.register(Chart.Decimation);
    Chart.register(window['chartjs-plugin-annotation']);

    // Initialize Managers
    (async () => await initializeManagers())();
});
/* DOCUMENT READY CALL ENDS */


/* FINANCIAL ITEMS MANAGER CONSTRUCTOR STARTS*/
    const financialItemsManager = {
        currentItem: null,
        currentPage: 1,

        items: JSON.parse(localStorage.getItem('financialItems')) || [],

        init: function() {
            // Remove all existing bindings for this manager before reinitializing
            $(document).off('.financialItemsManager');
            $('body').off('.financialItemsManager');

            this.items = JSON.parse(localStorage.getItem('financialItems')) || [];
            
            // Apply saved order if it exists
            const savedOrder = JSON.parse(localStorage.getItem('financialItemsOrder'));
            if (savedOrder) {
                this.items.sort((a, b) => {
                    const aIndex = savedOrder.indexOf(a.id);
                    const bIndex = savedOrder.indexOf(b.id);
                    return aIndex - bIndex;
                });
            }

            if (!$('#colorPreview').length) {
                // Update the modal HTML to include color preview
                $('#itemColor').parent().prepend(`
                    <div class="d-flex align-items-center mb-2">
                        <span id="colorPreview" class="color-preview" 
                            style="background-color: ${$('#itemColor option:first').val()}">
                        </span>
                        <small class="text-muted color-preview-text">Selected Color</small>
                    </div>
                `);
            }

            this.bindEvents();
            this.renderItems();
        },

        // Event handlers for financialItemsManager
        bindEvents: function() {
            // Handle financial item saving
            $('#saveItemBtn').off('click').on('click.financialItemsManager', function() {
                financialItemsManager.saveNewItem();
            });
            
            // Handle financial item visibility toggling
            $('#financialItemsList').on('change.financialItemsManager', '.toggle-input', (e) => {
                const $itemCard = $(e.target).closest('.financial-item');
                this.toggleItemVisibility($itemCard.data('itemId'), e.target.checked);
                chartManager.updateChart();
            });
        
            // Handle financial item deletion
            $('#financialItemsList').on('click.financialItemsManager', '.delete-item-btn, .delete-item-btn i', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const $itemCard = $(e.target).closest('.financial-item');
                if (this.deleteItem($itemCard.data('itemId'))) {
                    chartManager.updateChart();
                }
            });
        
            // Handle update data button
            $('#financialItemsList').on('click.financialItemsManager', '.update-data-btn', (e) => {
                const $itemCard = $(e.target).closest('.financial-item');
                this.showUpdateDataModal(String($itemCard.data('itemId')));
            });

            // Handle edit button
            $('#financialItemsList').on('click.financialItemsManager', '.edit-item-btn', (e) => {
                e.preventDefault();
                const $itemCard = $(e.target).closest('.financial-item');
                this.editItem($itemCard.data('itemId'));
            });

            // Handle show details collapse/expand
            $('#financialItemsList').on(
                'show.bs.collapse.financialItemsManager hide.bs.collapse.financialItemsManager',
                '.collapse-details', function(e) {
                    const button = $(this).siblings('.toggle-details');
                    const isShown = e.type === 'show';
                    button.find('span').text(isShown ? 'Hide Details' : 'Show Details');
                    if (isShown) { 
                        button.removeClass('collapsed').addClass('expanded'); 
                    } else { 
                        button.removeClass('expanded').addClass('collapsed');
                    }
            });
        
            // Handle format requirements collapse/expand
            $('#formatRequirementsToggler').on('click', function() {
                $('#formatRequirements').collapse('toggle');
                const $togglerBtn = $(this);
                $togglerBtn.text() === 'Show Details' ? $togglerBtn.text('Hide Details') : $togglerBtn.text('Show Details');
            });

            // Handle entries per page changes
            $('#entriesPerPage').on('change.financialItemsManager', () => {
                this.currentPage = 1; // Reset to first page
                this.displayEntries();
            });
        
            // Handle pagination
            $('#prevPage').on('click.financialItemsManager', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.displayEntries();
                }
            });
        
            $('#nextPage').on('click.financialItemsManager', () => {
                const totalPages = Math.ceil(this.currentItem.data.length / this.getEntriesPerPage());
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.displayEntries();
                }
            });
        
            // Handle manual entry form submission
            $('#manualEntryForm').on('submit.financialItemsManager', (e) => {
                e.preventDefault();
                this.handleManualEntry();
                chartManager.updateChart();
            });
        
            // Handle entry deletion
            $('#existingEntriesBody').on('click.financialItemsManager', '.delete-entry', (e) => {
                const entryId = $(e.currentTarget).data('entry-id');
                this.deleteEntry(entryId);
                chartManager.updateChart();
            });
        
            // Handle clear all entries
            $('#clearEntriesBtn').on('click.financialItemsManager', () => {
                this.clearAllEntries();
                chartManager.updateChart();
            });
        
            // Handle CSV file selection
            $('#csvFile').on('change.financialItemsManager', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.previewCSV(file);
                } else {
                    this.resetCSVPreview();
                }
            });
        
            // Handle CSV import button
            $('#importCsvBtn').on('click.financialItemsManager', () => {
                this.importCSVData();
                chartManager.updateChart();
            });

            $('#addItemModal').on('click.financialItemsManager', '.dropdown-item[data-value]', function() {
                const $dropdown = $(this).closest('.dropdown');
                const $button = $dropdown.find('.dropdown-toggle');
                const $hiddenInput = $dropdown.parent().find('input[type="hidden"]');

                $button.text($(this).text());
                $hiddenInput.val($(this).data('value'));

                if ($hiddenInput.attr('id') === 'itemColorValue') {
                    $('#colorPreview').css('background-color', $(this).data('value'));
                }

                // Show type-specific fields based on selected type
                const selectedType = $('#itemTypeValue').val();
                if (selectedType) {
                    $('#typeSpecificFields').show();
                    $('.type-field').hide();
                    $(`.type-field[data-type="${selectedType}"]`).show();
                }
            });

            // Handle color editing
            $('#editItemModal').on('click.financialItemsManager', '.dropdown-item[data-value]', function() {
                const color = $(this).data('value');
                $('#editItemColor').text($(this).text());
                $('#editItemColorValue').val(color);
            });

            /*
            // Handle color picker initialization
            let pickr = null;

            // Handle all dropdown item clicks in add modal (for both type and color selection)
            $('#addItemModal').on('click', '.dropdown-item:not(.custom-color-picker)', function() {
                const $dropdown = $(this).closest('.dropdown');
                const $button = $dropdown.find('.dropdown-toggle');
                const $hiddenInput = $dropdown.parent().find('input[type="hidden"]');
                
                $button.text($(this).text());
                $hiddenInput.val($(this).data('value'));

                // Handle color selection
                if ($hiddenInput.attr('id') === 'itemColorValue') {
                    $('#colorPreview').css('background-color', $(this).data('value'));
                }
                
                // Handle type selection
                const selectedType = $('#itemTypeValue').val();
                if (selectedType) {
                    $('#typeSpecificFields').show();
                    $('.type-field').hide();
                    $(`.type-field[data-type="${selectedType}"]`).show();
                }
            });

            // Handle color selection in edit modal
            $('#editItemModal').on('click', '.dropdown-item:not(.custom-color-picker)', function() {
                const color = $(this).data('value');
                $('#editItemColor').text($(this).text());
                $('#editItemColorValue').val(color);
            });

            // Handle custom color picker for both modals
            $('#addItemModal, #editItemModal').on('click', '.custom-color-picker', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                if (pickr) {
                    pickr.destroyAndRemove();
                }
                
                const $modal = $(this).closest('.modal');
                const $colorInput = $modal.find('input[type="hidden"]');
                const $colorPreview = $modal.find('.color-preview');
                
                pickr = Pickr.create({
                    el: this,
                    theme: 'nano',
                    default: $colorInput.val() || '#1f77b4',
                    components: {
                        preview: true,
                        opacity: true,
                        hue: true,
                        interaction: {
                            hex: true,
                            rgba: true,
                            input: true,
                            save: true,
                            cancel: true
                        }
                    }
                });

                // Handle color selection
                pickr.on('save', (color) => {
                    const hexColor = color.toHEXA().toString();
                    $colorInput.val(hexColor);
                    $colorPreview.css('background-color', hexColor);
                    pickr.hide();
                    
                    // Update dropdown text based on which modal we're in
                    if ($modal.attr('id') === 'addItemModal') {
                        $('#itemColor').text('Custom Color');
                    } else {
                        $('#editItemColor').text('Custom Color');
                    }
                });

                pickr.on('cancel', () => {
                    pickr.hide();
                });

                pickr.show();
            }); */

            // Add reset for type-specific fields
            $('#addItemModal, #editItemModal')
                .off('hidden.bs.modal')
                .on('hidden.bs.modal.financialItemsManager', function() {

                    // Get the modal instance
                    const modalInstance = bootstrap.Modal.getInstance(this);

                    // Force cleanup
                    if (modalInstance) {
                        modalInstance.dispose();

                        // Remove modal-specific classes and styles
                        $(this).removeClass('show');
                        $('.modal-backdrop').remove();
                        
                        // Reset body styles
                        $('body').removeClass('modal-open')
                                .css({
                                    'overflow': '',
                                    'padding-right': ''
                                })
                                .removeAttr('data-bs-padding-right');
                    }

                    // Reset forms based on which modal was closed
                    if (this.id === 'addItemModal') {
                        $('#addItemForm')[0].reset();
                        $('#itemType').text('Select type...');
                        $('#itemColor').text('Select color...');
                        $('#colorPreview').css('background-color', '');
                        $('#itemTypeValue, #itemColorValue').val('');
                        $('#typeSpecificFields').hide();
                        $('.type-field').hide();
                    } else if (this.id === 'editItemModal') {
                        $('#editItemForm')[0].reset();
                        $('#editItemColor').text('Select color...');
                        $('#colorPreview').css('background-color', '');
                        $('#editItemColorValue').val('');
                    }

                    /*
                    // Clean up pickr instance when modal is closed
                    if (pickr) {
                        pickr.destroyAndRemove();
                        pickr = null;
                    } */
            });

            $('#addItemModal').on('click.financialItemsManager', '.dropdown-item[data-value="asset"]', () => {
                this.populateAssetLoanDropdown();
            });

            // Handle save edit button
            $('#saveEditBtn').on('click.financialItemsManager', () => this.saveEditItem());
        },

        createInitialMetrics() {
            // Create empty monthly and yearly structure with current month/year
            const currentDate = moment();
            const currentMonth = currentDate.format('YYYY-MM');
            const currentYear = currentDate.format('YYYY');
        
            return {
                monthly: {
                    [currentMonth]: {}  // Will be populated based on type
                },
                yearly: {
                    [currentYear]: {}   // Will be populated based on type
                }
            };
        },

        calculateMetrics: function(item) {
            switch(item.type) {
                case 'account':
                    return this.calculateAccountMetrics(item);
                case 'credit':
                    return this.calculateCreditMetrics(item);
                case 'investment':
                    return this.calculateInvestmentMetrics(item);
                case 'loan':
                    return this.calculateLoanMetrics(item);
                case 'asset':
                    return this.calculateAssetMetrics(item);
            }
        },

        createTypeSpecificMetrics(type) {
            const baseMetrics = this.createInitialMetrics();
            const currentMonth = moment().format('YYYY-MM');
            const currentYear = moment().format('YYYY');
        
            switch(type) {
                case 'account':
                    baseMetrics.monthly[currentMonth] = {
                        value: 0,
                        averageValue: 0,
                        income: 0,
                        expenses: 0,
                        netChange: 0,
                        largestExpense: 0,
                        largestIncome: 0,
                        categorizedExpenses: {}
                    };
                    baseMetrics.yearly[currentYear] = {
                        value: 0,
                        totalIncome: 0,
                        totalExpenses: 0,
                        netChange: 0,
                        averageMonthlyIncome: 0,
                        averageMonthlyExpenses: 0
                    };
                    break;
        
                case 'credit':
                    baseMetrics.monthly[currentMonth] = {
                        totalSpent: 0,
                        averageBalance: 0,
                        payments: 0,
                        utilization: 0,
                        categorizedSpending: {},
                        averageTransactionSize: 0
                    };
                    baseMetrics.yearly[currentYear] = {
                        totalSpent: 0,
                        totalPayments: 0,
                        averageMonthlySpending: 0,
                        averageUtilization: 0
                    };
                    break;
        
                case 'investment':
                    baseMetrics.monthly[currentMonth] = {
                        averageValue: 0,
                        contributions: 0,
                        withdrawals: 0,
                        returns: 0,
                        returnsPercentage: 0,
                        fees: 0,
                        gainLoss: 0
                    };
                    baseMetrics.yearly[currentYear] = {
                        totalContributions: 0,
                        totalWithdrawals: 0,
                        totalReturns: 0,
                        annualizedReturn: 0,
                        totalFees: 0,
                        netGainLoss: 0
                    };
                    baseMetrics.performance = {
                        allTimeReturn: 0,
                        averageAnnualReturn: 0,
                        volatility: 0,
                        sharpeRatio: 0
                    };
                    break;
        
                case 'loan':
                    baseMetrics.monthly[currentMonth] = {
                        averageBalance: 0,
                        payment: 0,
                        principalPaid: 0,
                        interestPaid: 0,
                        remainingTerm: 0
                    };
                    baseMetrics.yearly[currentYear] = {
                        totalPaid: 0,
                        totalPrincipal: 0,
                        totalInterest: 0,
                        principalPaidPercentage: 0
                    };
                    baseMetrics.summary = {
                        totalPaidToDate: 0,
                        totalInterestPaid: 0,
                        percentagePaid: 0,
                        projectedPayoffDate: null,
                        earlyPayoffSavings: 0
                    };
                    break;
        
                case 'asset':
                    baseMetrics.monthly[currentMonth] = {
                        averageValue: 0,
                        value: 0,
                        valueChange: 0,
                        valueChangePercent: 0,
                    };
                    baseMetrics.yearly[currentYear] = {
                        totalValueChange: 0,
                        valueChangePercent: 0,
                        annualizedReturn: 0
                    };
                    baseMetrics.summary = {
                        totalAppreciation: 0,
                        annualizedReturn: 0,
                        currentEquity: 0,
                    };
                    break;
            }
        
            return baseMetrics;
        },

        calculateAccountMetrics: function(item) {
            const metrics = this.createTypeSpecificMetrics('account');
            let runningBalance = 0;
            
            // Get all unique months between start date and now
            const startDate = moment(item.data[0].date);
            const endDate = moment();
            const monthsArray = [];
            let currentDate = startDate.clone().startOf('month');
            
            while (currentDate.isSameOrBefore(endDate, 'month')) {
                monthsArray.push(currentDate.format('YYYY-MM'));
                currentDate.add(1, 'month');
            }
            
            const groupedTransactions = this.groupTransactionsByDate(item.data);
        
            // Process each month, whether it has transactions or not
            monthsArray.forEach(yearMonth => {
                const monthMetrics = {
                    value: runningBalance,
                    averageValue: 0,
                    income: 0,
                    expenses: 0,
                    netChange: 0,
                    largestExpense: 0,
                    largestIncome: 0,
                    categorizedExpenses: {}
                };

                // Calculate daily values for the month
                const monthStart = moment(yearMonth, 'YYYY-MM').startOf('month');
                const monthEnd = moment(yearMonth, 'YYYY-MM').endOf('month');
                let dailyValues = [];
                let currentValue = runningBalance;
        
                // If we have transactions for this month, process them
                if (groupedTransactions[yearMonth]) {

                    const monthTransactions = groupedTransactions[yearMonth];

                    let currentDay = monthStart.clone();
                    
                    // For each day of the month
                    while (currentDay.isSameOrBefore(monthEnd)) {
                        const dayStr = currentDay.format('YYYY-MM-DD');
                        
                        // Process any transactions for this day
                        monthTransactions.forEach(trans => {
                            if (moment(trans.date).format('YYYY-MM-DD') === dayStr) {
                                const amount = parseFloat(trans.amount);
                                if (trans.description === 'Initial Balance') {
                                    currentValue = amount;
                                } else {
                                    currentValue += amount;
                                }
                            }
                        });
                        
                        dailyValues.push(currentValue);
                        currentDay.add(1, 'days');
                    }
                    
                    // Calculate average value for the month
                    monthMetrics.averageValue = this.formatMetricNumber(
                        dailyValues.reduce((sum, value) => sum + value, 0) / dailyValues.length
                    );

                    groupedTransactions[yearMonth].forEach(trans => {
                        const amount = parseFloat(trans.amount);
                        if (trans.description === 'Initial Balance') {
                            runningBalance = amount;
                            monthMetrics.value = amount;
                        } else {
                            if (amount >= 0) {
                                monthMetrics.income += amount;
                                monthMetrics.largestIncome = Math.max(monthMetrics.largestIncome, amount);
                            } else {
                                monthMetrics.expenses += amount;
                                monthMetrics.largestExpense = Math.min(monthMetrics.largestExpense, amount);
                                
                                const category = this.detectTransactionCategory(trans.description);
                                if (!monthMetrics.categorizedExpenses[category]) {
                                    monthMetrics.categorizedExpenses[category] = 0;
                                }
                                monthMetrics.categorizedExpenses[category] += amount;
                            }
                            runningBalance += amount;
                            monthMetrics.value = runningBalance;
                        }
                    });
                } else {
                    // If no transactions, every day has the same value
                    monthMetrics.averageValue = this.formatMetricNumber(runningBalance);
                }
        
                // Always store the metrics for this month, even if no transactions
                monthMetrics.value = runningBalance;  // Ensure the month's value reflects current running balance
                monthMetrics.netChange = monthMetrics.income + monthMetrics.expenses;
                
                // Format monthly metrics
                monthMetrics.value = this.formatMetricNumber(monthMetrics.value);
                monthMetrics.income = this.formatMetricNumber(monthMetrics.income);
                monthMetrics.expenses = this.formatMetricNumber(monthMetrics.expenses);
                monthMetrics.netChange = this.formatMetricNumber(monthMetrics.netChange);
                monthMetrics.largestExpense = this.formatMetricNumber(monthMetrics.largestExpense);
                monthMetrics.largestIncome = this.formatMetricNumber(monthMetrics.largestIncome);
                monthMetrics.categorizedExpenses = this.formatMetricsObject(monthMetrics.categorizedExpenses);
        
                metrics.monthly[yearMonth] = monthMetrics;
        
                // Update yearly metrics
                const year = yearMonth.substring(0, 4);
                if (!metrics.yearly[year]) {
                    metrics.yearly[year] = {
                        value: runningBalance,
                        totalIncome: 0,
                        totalExpenses: 0,
                        netChange: 0,
                        averageMonthlyIncome: 0,
                        averageMonthlyExpenses: 0
                    };
                }
                metrics.yearly[year].value = runningBalance;  // Always update to current balance
                metrics.yearly[year].totalIncome += monthMetrics.income;
                metrics.yearly[year].totalExpenses += monthMetrics.expenses;
                metrics.yearly[year].netChange += monthMetrics.netChange;
            });
        
            // Format yearly metrics
            Object.keys(metrics.yearly).forEach(year => {
                const monthCount = Object.keys(metrics.monthly).filter(m => m.startsWith(year)).length;
                metrics.yearly[year] = {
                    value: this.formatMetricNumber(metrics.yearly[year].value),
                    totalIncome: this.formatMetricNumber(metrics.yearly[year].totalIncome),
                    totalExpenses: this.formatMetricNumber(metrics.yearly[year].totalExpenses),
                    netChange: this.formatMetricNumber(metrics.yearly[year].netChange),
                    averageMonthlyIncome: this.formatMetricNumber(metrics.yearly[year].totalIncome / monthCount),
                    averageMonthlyExpenses: this.formatMetricNumber(metrics.yearly[year].totalExpenses / monthCount)
                };
            });

            return { metrics, currentValue: this.formatMetricNumber(runningBalance) };
        },
        
        calculateCreditMetrics: function(item) {
            const metrics = this.createTypeSpecificMetrics('credit');
            let remainingBalance = 0;
        
            // Get all unique months between start date and now
            const startDate = moment(item.data[0].date);
            const endDate = moment();
            const monthsArray = [];
            let currentDate = startDate.clone().startOf('month');
            
            while (currentDate.isSameOrBefore(endDate, 'month')) {
                monthsArray.push(currentDate.format('YYYY-MM'));
                currentDate.add(1, 'month');
            }
            
            const groupedTransactions = this.groupTransactionsByDate(item.data);
        
            // Process each month, whether it has transactions or not
            monthsArray.forEach(yearMonth => {
                const monthMetrics = {
                    totalSpent: 0,
                    payments: 0,
                    utilization: 0,
                    remainingBalance: 0,
                    averageBalance: 0,
                    categorizedSpending: {},
                    averageTransactionSize: 0
                };
        
                // Calculate daily values for the month
                const monthStart = moment(yearMonth, 'YYYY-MM').startOf('month');
                const monthEnd = moment(yearMonth, 'YYYY-MM').endOf('month');
                let dailyValues = [];
                let currentValue = remainingBalance;
                let transactionCount = 0;
        
                // If we have transactions for this month, process them
                if (groupedTransactions[yearMonth]) {
                    const monthTransactions = groupedTransactions[yearMonth];
                    let currentDay = monthStart.clone();
                    
                    // For each day of the month
                    while (currentDay.isSameOrBefore(monthEnd)) {
                        const dayStr = currentDay.format('YYYY-MM-DD');
                        
                        // Process any transactions for this day
                        monthTransactions.forEach(trans => {
                            if (moment(trans.date).format('YYYY-MM-DD') === dayStr) {
                                const amount = parseFloat(trans.amount);
                                if (trans.description === 'Initial Balance') {
                                    remainingBalance = amount;
                                    currentValue = amount;
                                } else {
                                    if (amount < 0) {  // Spending
                                        monthMetrics.totalSpent += Math.abs(amount);
                                        transactionCount++;
                                        
                                        const category = this.detectTransactionCategory(trans.description);
                                        if (!monthMetrics.categorizedSpending[category]) {
                                            monthMetrics.categorizedSpending[category] = 0;
                                        }
                                        monthMetrics.categorizedSpending[category] += Math.abs(amount);
                                    } else {  // Payments
                                        monthMetrics.payments += amount;
                                    }
                                    remainingBalance -= amount;  // Note: Credit card balance is inverse
                                    currentValue = remainingBalance;
                                }
                            }
                        });
                        
                        dailyValues.push(currentValue);
                        currentDay.add(1, 'days');
                    }
                    
                    // Calculate average value for the month
                    monthMetrics.averageBalance = this.formatMetricNumber(
                        dailyValues.reduce((sum, value) => sum + value, 0) / dailyValues.length
                    );
                    monthMetrics.averageTransactionSize = transactionCount ? 
                        this.formatMetricNumber(monthMetrics.totalSpent / transactionCount) : 0;
                } else {
                    // If no transactions, every day has the same value
                    monthMetrics.averageBalance = this.formatMetricNumber(remainingBalance);
                }
        
                // Format monthly metrics
                monthMetrics.totalSpent = this.formatMetricNumber(monthMetrics.totalSpent);
                monthMetrics.payments = this.formatMetricNumber(monthMetrics.payments);
                monthMetrics.remainingBalance = this.formatMetricNumber(remainingBalance);
                monthMetrics.utilization = this.formatMetricNumber(
                    (remainingBalance / item.creditLimit) * 100
                );
                monthMetrics.categorizedSpending = this.formatMetricsObject(monthMetrics.categorizedSpending);
        
                metrics.monthly[yearMonth] = monthMetrics;
        
                // Update yearly metrics
                const year = yearMonth.substring(0, 4);
                if (!metrics.yearly[year]) {
                    metrics.yearly[year] = {
                        totalSpent: 0,
                        totalPayments: 0,
                        averageMonthlySpending: 0,
                        averageUtilization: 0,
                        endingBalance: remainingBalance
                    };
                }
                metrics.yearly[year].totalSpent += monthMetrics.totalSpent;
                metrics.yearly[year].totalPayments += monthMetrics.payments;
                metrics.yearly[year].endingBalance = remainingBalance;
            });
        
            // Format yearly metrics
            Object.keys(metrics.yearly).forEach(year => {
                const monthCount = Object.keys(metrics.monthly).filter(m => m.startsWith(year)).length;
                metrics.yearly[year] = {
                    totalSpent: this.formatMetricNumber(metrics.yearly[year].totalSpent),
                    totalPayments: this.formatMetricNumber(metrics.yearly[year].totalPayments),
                    averageMonthlySpending: this.formatMetricNumber(metrics.yearly[year].totalSpent / monthCount),
                    averageUtilization: this.formatMetricNumber(
                        Object.values(metrics.monthly)
                            .filter(m => m.utilization)
                            .reduce((sum, m) => sum + m.utilization, 0) / monthCount
                    ),
                    endingBalance: this.formatMetricNumber(metrics.yearly[year].endingBalance)
                };
            });
        
            return { metrics, currentBalance: this.formatMetricNumber(remainingBalance) };
        },

        /*
        calculateCreditMetrics: function(item) {
            const metrics = this.createTypeSpecificMetrics('credit');
            let remainingBalance = 0;
        
            const groupedTransactions = this.groupTransactionsByDate(item.data);
        
            Object.entries(groupedTransactions).forEach(([yearMonth, transactions]) => {
                const monthMetrics = {
                    totalSpent: 0,
                    payments: 0,
                    utilization: 0,
                    remainingBalance: 0,
                    categorizedSpending: {},
                    averageTransactionSize: 0
                };
        
                let transactionCount = 0;
                transactions.forEach(trans => {
                    const amount = parseFloat(trans.amount);
                    if (amount < 0) {  // Spending
                        monthMetrics.totalSpent += Math.abs(amount);
                        transactionCount++;
                        
                        const category = this.detectTransactionCategory(trans.description);
                        if (!monthMetrics.categorizedSpending[category]) {
                            monthMetrics.categorizedSpending[category] = 0;
                        }
                        monthMetrics.categorizedSpending[category] += Math.abs(amount);
                    } else {  // Payments
                        monthMetrics.payments += amount;
                    }
                    remainingBalance -= amount;  // Note: Credit card balance is inverse
                });
        
                // Format all the numbers
                monthMetrics.totalSpent = this.formatMetricNumber(monthMetrics.totalSpent);
                monthMetrics.payments = this.formatMetricNumber(monthMetrics.payments);
                monthMetrics.averageTransactionSize = this.formatMetricNumber(
                    transactionCount ? monthMetrics.totalSpent / transactionCount : 0
                );
                monthMetrics.remainingBalance = this.formatMetricNumber(remainingBalance);
                monthMetrics.utilization = this.formatMetricNumber(
                    (remainingBalance / item.creditLimit) * 100
                );
        
                // Format categorized spending
                monthMetrics.categorizedSpending = this.formatMetricsObject(monthMetrics.categorizedSpending);
        
                metrics.monthly[yearMonth] = monthMetrics;
        
                // Update yearly metrics
                const year = yearMonth.substring(0, 4);
                if (!metrics.yearly[year]) {
                    metrics.yearly[year] = {
                        totalSpent: 0,
                        totalPayments: 0,
                        averageMonthlySpending: 0,
                        averageUtilization: 0,
                        endingBalance: 0
                    };
                }
                metrics.yearly[year].totalSpent += monthMetrics.totalSpent;
                metrics.yearly[year].totalPayments += monthMetrics.payments;
                metrics.yearly[year].endingBalance = remainingBalance;
            });
        
            // Calculate and format yearly averages
            Object.values(metrics.yearly).forEach(yearMetrics => {
                const monthCount = Object.keys(metrics.monthly).filter(m => m.startsWith(yearMetrics.year)).length;
                yearMetrics.averageMonthlySpending = this.formatMetricNumber(yearMetrics.totalSpent / monthCount);
                yearMetrics.averageUtilization = this.formatMetricNumber(
                    Object.values(metrics.monthly)
                        .filter(m => m.utilization)
                        .reduce((sum, m) => sum + m.utilization, 0) / monthCount
                );
                yearMetrics.totalSpent = this.formatMetricNumber(yearMetrics.totalSpent);
                yearMetrics.totalPayments = this.formatMetricNumber(yearMetrics.totalPayments);
                yearMetrics.endingBalance = this.formatMetricNumber(yearMetrics.endingBalance);
            });
        
            return { 
                metrics, 
                currentBalance: this.formatMetricNumber(remainingBalance)
            };
        }, */

        // Helper functions
        groupTransactionsByDate: function(transactions) {
            const grouped = {};
            transactions.forEach(trans => {
                const date = moment(trans.date);
                const yearMonth = date.format('YYYY-MM');
                if (!grouped[yearMonth]) {
                    grouped[yearMonth] = [];
                }
                grouped[yearMonth].push(trans);
            });
            return grouped;
        },

        detectTransactionCategory: function(description) {
            // Basic category detection based on keywords
            description = description.toLowerCase();
            
            const categories = {
                groceries: ['grocery', 'supermarket', 'food'],
                dining: ['restaurant', 'cafe', 'dining'],
                utilities: ['utility', 'electric', 'water', 'gas'],
                transport: ['gas station', 'fuel', 'transport'],
                shopping: ['amazon', 'shopping', 'store'],
                bills: ['bill', 'payment', 'insurance'],
                entertainment: ['movie', 'theatre', 'entertainment'],
                // Add more categories as needed
            };

            for (const [category, keywords] of Object.entries(categories)) {
                if (keywords.some(keyword => description.includes(keyword))) {
                    return category;
                }
            }

            return 'other';
        },

        processCreditCardAmount: function(amount, isInitial = false) {
            // For initial balance or purchases, store negative but return positive for plotting
            if (amount < 0 || isInitial) {
                return {
                    storedAmount: -Math.abs(amount),
                    plottedAmount: Math.abs(amount)
                };
            }
            // For payments, store positive but return negative for plotting
            return {
                storedAmount: amount,
                plottedAmount: -amount
            };
        },

        /*
        calculateInvestmentMetrics: function(item) {
            const metrics = this.createTypeSpecificMetrics('investment');
            let currentValue = item.initialInvestment;
            let totalContributions = item.initialInvestment;
            let totalReturns = 0;
            let totalFees = 0;
        
            const groupedTransactions = this.groupTransactionsByDate(item.data);
            const allMonthlyReturns = [];
        
            Object.entries(groupedTransactions).forEach(([yearMonth, transactions]) => {
                const monthMetrics = {
                    contributions: 0,
                    withdrawals: 0,
                    returns: 0,
                    fees: 0,
                    gainLoss: 0,
                    returnsPercentage: 0
                };
        
                const startValue = currentValue;

                transactions.forEach(trans => {
                    const amount = parseFloat(trans.amount);
                    if (this.isInvestmentContribution(trans.description)) {
                        monthMetrics.contributions += amount;
                        totalContributions += amount;
                    } else if (this.isInvestmentReturn(trans.description)) {
                        monthMetrics.returns += amount;
                        totalReturns += amount;
                    } else if (this.isInvestmentFee(trans.description)) {
                        monthMetrics.fees += amount;
                        totalFees += amount;
                    } else if (this.isInvestmentWithdrawal(trans.description)) {
                        monthMetrics.withdrawals += amount;
                        totalWithdrawals += amount;
                    }
                    currentValue += amount;
                });
        
                // Calculate monthly return percentage
                const monthlyContributions = monthMetrics.contributions;
                const adjustedStartValue = startValue + (monthlyContributions / 2); // Time-weighted adjustment
                monthMetrics.returnsPercentage = adjustedStartValue !== 0 ? 
                    (monthMetrics.returns / adjustedStartValue) * 100 : 0;
        
                // Track monthly returns for volatility calculation
                if (adjustedStartValue !== 0) {
                    allMonthlyReturns.push(monthMetrics.returnsPercentage / 100); // Store as decimal
                }
        
                monthMetrics.gainLoss = monthMetrics.returns + monthMetrics.fees;
        
                // Format monthly metrics
                Object.keys(monthMetrics).forEach(key => {
                    monthMetrics[key] = this.formatMetricNumber(monthMetrics[key]);
                });
        
                metrics.monthly[yearMonth] = monthMetrics;
        
                // Update yearly metrics
                const year = yearMonth.substring(0, 4);
                if (!metrics.yearly[year]) {
                    metrics.yearly[year] = {
                        totalContributions: 0,
                        totalWithdrawals: 0,
                        totalReturns: 0,
                        totalFees: 0,
                        netGainLoss: 0,
                        annualizedReturn: 0
                    };
                }
        
                // Accumulate yearly totals
                metrics.yearly[year].totalContributions += monthMetrics.contributions;
                metrics.yearly[year].totalWithdrawals += monthMetrics.withdrawals;
                metrics.yearly[year].totalReturns += monthMetrics.returns;
                metrics.yearly[year].totalFees += monthMetrics.fees;
                metrics.yearly[year].netGainLoss += monthMetrics.gainLoss;
            });
        
            // Calculate performance metrics
            const totalReturn = currentValue - totalContributions;
            const totalReturnPercentage = totalContributions !== 0 ? 
                (totalReturn / totalContributions) * 100 : 0;
        
            // Calculate time-weighted return
            const yearsSinceStart = moment().diff(moment(item.data[0].date), 'years', true);
            const annualizedReturn = this.calculateAnnualizedReturn(
                totalContributions, 
                currentValue, 
                yearsSinceStart
            );
        
            // Calculate volatility and Sharpe ratio if we have enough data
            const volatility = this.calculateVolatility(allMonthlyReturns);
            const sharpeRatio = this.calculateSharpeRatio(allMonthlyReturns);
        
            metrics.performance = {
                totalContributions: this.formatMetricNumber(totalContributions),
                totalReturns: this.formatMetricNumber(totalReturns),
                totalFees: this.formatMetricNumber(totalFees),
                totalReturnPercentage: this.formatMetricNumber(totalReturnPercentage),
                annualizedReturn: this.formatMetricNumber(annualizedReturn),
                volatility: this.formatMetricNumber(volatility * 100), // Convert to percentage
                sharpeRatio: this.formatMetricNumber(sharpeRatio)
            };
        
            return { 
                metrics, 
                currentValue: this.formatMetricNumber(currentValue)
            };
        }, */

        calculateInvestmentMetrics: function(item) {
            const metrics = this.createTypeSpecificMetrics('investment');
            let currentValue = 0;
            let totalContributions = 0;
            let totalReturns = 0;
            let totalFees = 0;
        
            // Get all unique months between start date and now
            const startDate = moment(item.data[0].date);
            const endDate = moment();
            const monthsArray = [];
            let currentDate = startDate.clone().startOf('month');
            
            while (currentDate.isSameOrBefore(endDate, 'month')) {
                monthsArray.push(currentDate.format('YYYY-MM'));
                currentDate.add(1, 'month');
            }
            
            const groupedTransactions = this.groupTransactionsByDate(item.data);
        
            // Process each month, whether it has transactions or not
            monthsArray.forEach(yearMonth => {
                const monthMetrics = {
                    value: currentValue,
                    averageValue: 0,
                    contributions: 0,
                    withdrawals: 0,
                    returns: 0,
                    fees: 0,
                    gainLoss: 0,
                    returnsPercentage: 0
                };
        
                // Calculate daily values for the month
                const monthStart = moment(yearMonth, 'YYYY-MM').startOf('month');
                const monthEnd = moment(yearMonth, 'YYYY-MM').endOf('month');
                let dailyValues = [];
                let currentDayValue = currentValue;
                const startValue = currentValue; // Store start value for percentage calculation
        
                // If we have transactions for this month, process them
                if (groupedTransactions[yearMonth]) {
                    const monthTransactions = groupedTransactions[yearMonth];
                    let currentDay = monthStart.clone();
                    
                    // For each day of the month
                    while (currentDay.isSameOrBefore(monthEnd)) {
                        const dayStr = currentDay.format('YYYY-MM-DD');
                        
                        // Process any transactions for this day
                        monthTransactions.forEach(trans => {
                            
                            if (moment(trans.date).format('YYYY-MM-DD') === dayStr) {
                                const amount = parseFloat(trans.amount);
                                
                                if (trans.description === 'Initial Investment') {
                                    currentValue = amount;
                                    currentDayValue = amount;
                                    totalContributions += amount;
                                    monthMetrics.contributions += amount;
                                } else if (this.isInvestmentContribution(trans.description)) {
                                    monthMetrics.contributions += amount;
                                    totalContributions += amount;
                                    currentValue += amount;
                                    currentDayValue = currentValue;
                                } else if (this.isInvestmentReturn(trans.description)) {
                                    monthMetrics.returns += amount;
                                    totalReturns += amount;
                                    currentValue += amount;
                                    currentDayValue = currentValue;
                                } else if (this.isInvestmentFee(trans.description)) {
                                    monthMetrics.fees += amount;
                                    totalFees += amount;
                                    currentValue += amount;
                                    currentDayValue = currentValue;
                                } else if (this.isInvestmentWithdrawal(trans.description)) {
                                    monthMetrics.withdrawals += amount;
                                    currentValue += amount;
                                    currentDayValue = currentValue;
                                }
                            }
                        });
                        
                        dailyValues.push(currentDayValue);
                        currentDay.add(1, 'days');
                    }
                    
                    // Calculate average value for the month
                    monthMetrics.averageValue = this.formatMetricNumber(
                        dailyValues.reduce((sum, value) => sum + value, 0) / dailyValues.length
                    );
        
                    // Calculate monthly return percentage
                    const monthlyContributions = monthMetrics.contributions;
                    const adjustedStartValue = startValue + (monthlyContributions / 2); // Time-weighted adjustment
                    monthMetrics.returnsPercentage = adjustedStartValue !== 0 ? 
                        (monthMetrics.returns / adjustedStartValue) * 100 : 0;
                } else {
                    // If no transactions, every day has the same value
                    monthMetrics.averageValue = this.formatMetricNumber(currentValue);
                    monthMetrics.returnsPercentage = 0;
                }
        
                monthMetrics.value = currentValue;
                monthMetrics.gainLoss = monthMetrics.returns + monthMetrics.fees;
        
                // Format monthly metrics
                Object.keys(monthMetrics).forEach(key => {
                    monthMetrics[key] = this.formatMetricNumber(monthMetrics[key]);
                });
        
                metrics.monthly[yearMonth] = monthMetrics;
        
                // Update yearly metrics
                const year = yearMonth.substring(0, 4);
                if (!metrics.yearly[year]) {
                    metrics.yearly[year] = {
                        totalContributions: 0,
                        totalWithdrawals: 0,
                        totalReturns: 0,
                        totalFees: 0,
                        netGainLoss: 0,
                        annualizedReturn: 0,
                        endingValue: currentValue
                    };
                }
                metrics.yearly[year].totalContributions += monthMetrics.contributions;
                metrics.yearly[year].totalWithdrawals += monthMetrics.withdrawals;
                metrics.yearly[year].totalReturns += monthMetrics.returns;
                metrics.yearly[year].totalFees += monthMetrics.fees;
                metrics.yearly[year].netGainLoss += monthMetrics.gainLoss;
                metrics.yearly[year].endingValue = currentValue;
            });
        
            // Calculate performance metrics
            const totalReturn = currentValue - totalContributions;
            const totalReturnPercentage = totalContributions !== 0 ? 
                (totalReturn / totalContributions) * 100 : 0;
        
            // Calculate annualized return
            const yearsSinceStart = moment().diff(startDate, 'years', true);
            const annualizedReturn = this.calculateAnnualizedReturn(
                totalContributions, 
                currentValue, 
                yearsSinceStart
            );
        
            metrics.performance = {
                totalContributions: this.formatMetricNumber(totalContributions),
                totalReturns: this.formatMetricNumber(totalReturns),
                totalFees: this.formatMetricNumber(totalFees),
                totalReturnPercentage: this.formatMetricNumber(totalReturnPercentage),
                annualizedReturn: this.formatMetricNumber(annualizedReturn)
            };
        
            return { metrics, currentValue: this.formatMetricNumber(currentValue) };
        },

        /*
        calculateLoanMetrics: function(item) {
            const metrics = this.createTypeSpecificMetrics('loan');
            let balance = item.originalAmount; // Starting with positive loan amount
        
            const groupedTransactions = this.groupTransactionsByDate(item.data);
            let totalPaid = 0;
            let totalInterest = 0;
        
            Object.entries(groupedTransactions).forEach(([yearMonth, transactions]) => {
                const monthMetrics = {
                    payment: 0,
                    principalPaid: 0,
                    interestPaid: 0,
                    remainingTerm: 0
                };
        
                transactions.forEach(trans => {
                    const amount = Number(trans.amount);
                    if (trans.description === 'Initial Loan Amount') {
                        balance = amount; // Set initial balance
                    } else if (this.isLoanPayment(trans.description)) {
                        monthMetrics.payment += Math.abs(amount);
                        // Calculate interest first based on current balance
                        const monthlyInterest = (balance * (item.interestRate / 100)) / 12;
                        monthMetrics.interestPaid += monthlyInterest;
                        // Principal paid is payment minus interest
                        const principalPaid = Math.abs(amount) - monthlyInterest;
                        monthMetrics.principalPaid += principalPaid;
                        // Update balance (reduce it by principal paid)
                        balance -= principalPaid;
                        
                        totalPaid += Math.abs(amount);
                        totalInterest += monthlyInterest;
                    }
                });
        
                monthMetrics.remainingBalance = balance;
                
                if (monthMetrics.payment > 0 && item.paymentAmount) {
                    monthMetrics.remainingTerm = this.calculateRemainingTerm(
                        balance, item.interestRate, item.paymentAmount
                    );
                }
        
                // Format monthly metrics
                Object.keys(monthMetrics).forEach(key => {
                    monthMetrics[key] = this.formatMetricNumber(monthMetrics[key]);
                });
        
                metrics.monthly[yearMonth] = monthMetrics;
        
                // Update yearly metrics
                const year = yearMonth.substring(0, 4);
                if (!metrics.yearly[year]) {
                    metrics.yearly[year] = {
                        totalPaid: 0,
                        totalPrincipal: 0,
                        totalInterest: 0,
                        principalPaidPercentage: 0,
                        remainingBalance: balance
                    };
                }
                metrics.yearly[year].totalPaid += monthMetrics.payment;
                metrics.yearly[year].totalPrincipal += monthMetrics.principalPaid;
                metrics.yearly[year].totalInterest += monthMetrics.interestPaid;
            });
        
            // Calculate and store loan summary metrics
            metrics.summary = {
                totalPaidToDate: this.formatMetricNumber(totalPaid),
                totalInterestPaid: this.formatMetricNumber(totalInterest),
                percentagePaid: this.formatMetricNumber((totalPaid / item.originalAmount) * 100),
                projectedPayoffDate: item.paymentAmount ? 
                    this.calculateProjectedPayoffDate(balance, item.interestRate, item.paymentAmount) : null,
                earlyPayoffSavings: item.paymentAmount ?
                    this.formatMetricNumber(this.calculateEarlyPayoffSavings(balance, item.interestRate, item.paymentAmount)) : 0
            };
        
            return { metrics, currentBalance: this.formatMetricNumber(balance) };
        }, */

        calculateLoanMetrics: function(item) {
            const metrics = this.createTypeSpecificMetrics('loan');
            let balance = item.originalAmount; // Start with original loan amount
        
            // Get all unique months between start date and now
            const startDate = moment(item.data[0].date);
            const endDate = moment();
            const monthsArray = [];
            let currentDate = startDate.clone().startOf('month');
            
            while (currentDate.isSameOrBefore(endDate, 'month')) {
                monthsArray.push(currentDate.format('YYYY-MM'));
                currentDate.add(1, 'month');
            }
            
            const groupedTransactions = this.groupTransactionsByDate(item.data);
            let totalPaid = 0;
            let totalInterest = 0;
        
            // Process each month, whether it has transactions or not
            monthsArray.forEach(yearMonth => {
                const monthMetrics = {
                    balance: balance,
                    averageBalance: 0,
                    payment: 0,
                    principalPaid: 0,
                    interestPaid: 0,
                    remainingTerm: 0
                };
        
                // Calculate daily values for the month
                const monthStart = moment(yearMonth, 'YYYY-MM').startOf('month');
                const monthEnd = moment(yearMonth, 'YYYY-MM').endOf('month');
                let dailyValues = [];
                let currentDayBalance = balance;
        
                // If we have transactions for this month, process them
                if (groupedTransactions[yearMonth]) {
                    const monthTransactions = groupedTransactions[yearMonth];
                    let currentDay = monthStart.clone();
                    
                    // For each day of the month
                    while (currentDay.isSameOrBefore(monthEnd)) {
                        const dayStr = currentDay.format('YYYY-MM-DD');
                        
                        // Process any transactions for this day
                        monthTransactions.forEach(trans => {
                            if (moment(trans.date).format('YYYY-MM-DD') === dayStr) {
                                const amount = parseFloat(trans.amount);
                                
                                if (trans.description === 'Initial Loan Amount') {
                                    balance = amount;
                                    currentDayBalance = amount;
                                } else if (this.isLoanPayment(trans.description)) {
                                    monthMetrics.payment += Math.abs(amount);
                                    // Calculate interest first based on current balance
                                    const monthlyInterest = (balance * (item.interestRate / 100)) / 12;
                                    monthMetrics.interestPaid += monthlyInterest;
                                    // Principal paid is payment minus interest
                                    const principalPaid = Math.abs(amount) - monthlyInterest;
                                    monthMetrics.principalPaid += principalPaid;
                                    // Update balance
                                    balance -= principalPaid;
                                    currentDayBalance = balance;
                                    
                                    totalPaid += Math.abs(amount);
                                    totalInterest += monthlyInterest;
                                }
                            }
                        });
                        
                        dailyValues.push(currentDayBalance);
                        currentDay.add(1, 'days');
                    }
                    
                    // Calculate average balance for the month
                    monthMetrics.averageBalance = this.formatMetricNumber(
                        dailyValues.reduce((sum, value) => sum + value, 0) / dailyValues.length
                    );
                } else {
                    // If no transactions, every day has the same value
                    monthMetrics.averageBalance = this.formatMetricNumber(balance);
                }
        
                monthMetrics.balance = balance;
                
                if (monthMetrics.payment > 0 && item.paymentAmount) {
                    monthMetrics.remainingTerm = this.calculateRemainingTerm(
                        balance, item.interestRate, item.paymentAmount
                    );
                }
        
                // Format monthly metrics
                Object.keys(monthMetrics).forEach(key => {
                    monthMetrics[key] = this.formatMetricNumber(monthMetrics[key]);
                });
        
                metrics.monthly[yearMonth] = monthMetrics;
        
                // Update yearly metrics
                const year = yearMonth.substring(0, 4);
                if (!metrics.yearly[year]) {
                    metrics.yearly[year] = {
                        totalPaid: 0,
                        totalPrincipal: 0,
                        totalInterest: 0,
                        principalPaidPercentage: 0,
                        endingBalance: balance
                    };
                }
                metrics.yearly[year].totalPaid += monthMetrics.payment;
                metrics.yearly[year].totalPrincipal += monthMetrics.principalPaid;
                metrics.yearly[year].totalInterest += monthMetrics.interestPaid;
                metrics.yearly[year].endingBalance = balance;
            });
        
            // Format yearly metrics
            Object.keys(metrics.yearly).forEach(year => {
                const totalPaid = metrics.yearly[year].totalPaid;
                metrics.yearly[year] = {
                    totalPaid: this.formatMetricNumber(metrics.yearly[year].totalPaid),
                    totalPrincipal: this.formatMetricNumber(metrics.yearly[year].totalPrincipal),
                    totalInterest: this.formatMetricNumber(metrics.yearly[year].totalInterest),
                    principalPaidPercentage: this.formatMetricNumber(
                        (metrics.yearly[year].totalPrincipal / item.originalAmount) * 100
                    ),
                    endingBalance: this.formatMetricNumber(metrics.yearly[year].endingBalance)
                };
            });
        
            // Calculate and store loan summary metrics
            metrics.summary = {
                totalPaidToDate: this.formatMetricNumber(totalPaid),
                totalInterestPaid: this.formatMetricNumber(totalInterest),
                percentagePaid: this.formatMetricNumber((totalPaid / item.originalAmount) * 100),
                projectedPayoffDate: item.paymentAmount ? 
                    this.calculateProjectedPayoffDate(balance, item.interestRate, item.paymentAmount) : null,
                earlyPayoffSavings: item.paymentAmount ?
                    this.formatMetricNumber(this.calculateEarlyPayoffSavings(balance, item.interestRate, item.paymentAmount)) : 0
            };
        
            return { metrics, currentBalance: this.formatMetricNumber(balance) };
        },

        generateLoanPayments: function(startDate, endDate, amount, frequency) {
            if (!amount || !frequency) return [];
            
            const payments = [];
            let currentDate = moment(startDate);
            const end = moment(endDate);
            
            while (currentDate.isSameOrBefore(end)) {
                // Skip if current date is start date (we already have initial balance entry)
                if (!currentDate.isSame(moment(startDate))) {
                    switch (frequency) {
                        case 'weekly':
                            if (currentDate.day() === moment(startDate).day()) {
                                payments.push({
                                    date: currentDate.format('YYYY-MM-DD'),
                                    amount: -amount
                                });
                            }
                            break;
                            
                        case 'biweekly':
                            if (currentDate.diff(moment(startDate), 'weeks') % 2 === 0 &&
                                currentDate.day() === moment(startDate).day()) {
                                payments.push({
                                    date: currentDate.format('YYYY-MM-DD'),
                                    amount: -amount
                                });
                            }
                            break;
                            
                        case 'semimonthly':
                            if (currentDate.date() === 15 || currentDate.date() === currentDate.daysInMonth()) {
                                payments.push({
                                    date: currentDate.format('YYYY-MM-DD'),
                                    amount: -amount
                                });
                            }
                            break;
                            
                        case 'monthly':
                            if (currentDate.date() === moment(startDate).date()) {
                                payments.push({
                                    date: currentDate.format('YYYY-MM-DD'),
                                    amount: -amount
                                });
                            }
                            break;
                    }
                }
                currentDate.add(1, 'days');
            }
            
            return payments;
        },
        
        /*
        // Update the asset metrics calculation to include equity
        calculateAssetMetrics: function(item) {
            const metrics = this.createTypeSpecificMetrics('asset');
            let currentValue = item.currentValue;
        
            const groupedTransactions = this.groupTransactionsByDate(item.data);
        
            Object.entries(groupedTransactions).forEach(([yearMonth, transactions]) => {
                const monthMetrics = {
                    value: 0,
                    averageValue: 0,
                    valueChange: 0,
                    valueChangePercent: 0,
                    appreciation: 0,
                    equity: 0
                };
            
                transactions.forEach(trans => {
                    if (this.isAssetValueChange(trans.description)) {
                        const newValue = parseFloat(trans.amount);
                        monthMetrics.valueChange = this.formatMetricNumber(newValue - currentValue);
                        monthMetrics.valueChangePercent = this.formatMetricNumber(
                            ((newValue - currentValue) / currentValue) * 100
                        );
                        monthMetrics.appreciation = this.formatMetricNumber(newValue - item.purchasePrice);
                        currentValue = newValue;
                        // Calculate equity at this specific date
                        monthMetrics.equity = this.calculateAssetEquity(item, trans.date);
                    }
                });
            
                // If no transactions this month, still calculate equity
                if (monthMetrics.equity === 0) {
                    monthMetrics.equity = this.calculateAssetEquity(item, yearMonth + '-01');
                }
            
                metrics.monthly[yearMonth] = monthMetrics;
        
                // Update yearly metrics
                const year = yearMonth.substring(0, 4);
                if (!metrics.yearly[year]) {
                    metrics.yearly[year] = {
                        totalValueChange: 0,
                        valueChangePercent: 0,
                        endingValue: currentValue,
                        endingEquity: monthMetrics.equity
                    };
                }
                metrics.yearly[year].totalValueChange += monthMetrics.valueChange;
                metrics.yearly[year].valueChangePercent = this.formatMetricNumber(
                    ((currentValue - item.purchasePrice) / item.purchasePrice) * 100
                );
                metrics.yearly[year].endingValue = currentValue;
                metrics.yearly[year].endingEquity = monthMetrics.equity;
            });
        
            // Update the asset's current metrics
            const totalAppreciation = this.formatMetricNumber(currentValue - item.purchasePrice);
            const totalAppreciationPercent = this.formatMetricNumber(
                ((currentValue - item.purchasePrice) / item.purchasePrice) * 100
            );
            
            metrics.summary = {
                purchasePrice: this.formatMetricNumber(item.purchasePrice),
                currentValue: this.formatMetricNumber(currentValue),
                totalAppreciation: totalAppreciation,
                totalAppreciationPercent: totalAppreciationPercent,
                currentEquity: this.calculateAssetEquity({
                    ...item,
                    currentValue: currentValue
                })
            };
        
            return { metrics, currentValue: this.formatMetricNumber(currentValue) };
        }, */

        calculateAssetMetrics: function(item) {
            const metrics = this.createTypeSpecificMetrics('asset');
            let currentValue = item.purchasePrice;
        
            // Get all unique months between start date and now
            const startDate = moment(item.data[0].date);
            const endDate = moment();
            const monthsArray = [];
            let currentDate = startDate.clone().startOf('month');
            
            while (currentDate.isSameOrBefore(endDate, 'month')) {
                monthsArray.push(currentDate.format('YYYY-MM'));
                currentDate.add(1, 'month');
            }
            
            const groupedTransactions = this.groupTransactionsByDate(item.data);
        
            // Process each month, whether it has transactions or not
            monthsArray.forEach(yearMonth => {
                const monthMetrics = {
                    value: currentValue,
                    averageValue: 0,
                    valueChange: 0,
                    valueChangePercent: 0,
                    appreciation: 0,
                    equity: 0
                };
        
                // Calculate daily values for the month
                const monthStart = moment(yearMonth, 'YYYY-MM').startOf('month');
                const monthEnd = moment(yearMonth, 'YYYY-MM').endOf('month');
                let dailyValues = [];
                let currentDayValue = currentValue;
                const startValue = currentValue; // Store start value for percentage calculation
        
                // If we have transactions for this month, process them
                if (groupedTransactions[yearMonth]) {
                    const monthTransactions = groupedTransactions[yearMonth];
                    let currentDay = monthStart.clone();
                    
                    // For each day of the month
                    while (currentDay.isSameOrBefore(monthEnd)) {
                        const dayStr = currentDay.format('YYYY-MM-DD');
                        
                        // Process any transactions for this day
                        monthTransactions.forEach(trans => {
                            if (moment(trans.date).format('YYYY-MM-DD') === dayStr) {
                                if (this.isAssetValueChange(trans.description)) {
                                    const newValue = parseFloat(trans.amount);
                                    monthMetrics.valueChange = newValue - currentValue;
                                    monthMetrics.valueChangePercent = ((newValue - currentValue) / currentValue) * 100;
                                    monthMetrics.appreciation = newValue - item.purchasePrice;
                                    currentValue = newValue;
                                    currentDayValue = newValue;
                                }
                            }
                        });
                        
                        // Calculate equity at this specific date
                        monthMetrics.equity = this.calculateAssetEquity({
                            ...item,
                            currentValue: currentDayValue
                        }, dayStr);
        
                        dailyValues.push(currentDayValue);
                        currentDay.add(1, 'days');
                    }
                    
                    // Calculate average value for the month
                    monthMetrics.averageValue = this.formatMetricNumber(
                        dailyValues.reduce((sum, value) => sum + value, 0) / dailyValues.length
                    );
                } else {
                    // If no transactions, every day has the same value
                    monthMetrics.averageValue = this.formatMetricNumber(currentValue);
                    monthMetrics.equity = this.calculateAssetEquity({
                        ...item,
                        currentValue: currentValue
                    }, monthStart.format('YYYY-MM-DD'));
                }
        
                monthMetrics.value = currentValue;
                
                // Format monthly metrics
                Object.keys(monthMetrics).forEach(key => {
                    monthMetrics[key] = this.formatMetricNumber(monthMetrics[key]);
                });
        
                metrics.monthly[yearMonth] = monthMetrics;
        
                // Update yearly metrics
                const year = yearMonth.substring(0, 4);
                if (!metrics.yearly[year]) {
                    metrics.yearly[year] = {
                        totalValueChange: 0,
                        valueChangePercent: 0,
                        endingValue: currentValue,
                        endingEquity: monthMetrics.equity
                    };
                }
                metrics.yearly[year].totalValueChange += monthMetrics.valueChange;
                metrics.yearly[year].valueChangePercent = this.formatMetricNumber(
                    ((currentValue - item.purchasePrice) / item.purchasePrice) * 100
                );
                metrics.yearly[year].endingValue = currentValue;
                metrics.yearly[year].endingEquity = monthMetrics.equity;
            });
        
            // Calculate summary metrics
            const totalAppreciation = currentValue - item.purchasePrice;
            const totalAppreciationPercent = ((currentValue - item.purchasePrice) / item.purchasePrice) * 100;
        
            metrics.summary = {
                purchasePrice: this.formatMetricNumber(item.purchasePrice),
                currentValue: this.formatMetricNumber(currentValue),
                totalAppreciation: this.formatMetricNumber(totalAppreciation),
                totalAppreciationPercent: this.formatMetricNumber(totalAppreciationPercent),
                currentEquity: this.calculateAssetEquity({
                    ...item,
                    currentValue: currentValue
                })
            };
        
            return { metrics, currentValue: this.formatMetricNumber(currentValue) };
        },

        populateAssetLoanDropdown: function() {
            const $loanSelect = $('#assetLoan');
            $loanSelect.find('option').not(':first').remove();  // Clear existing options except first
        
            // Get all loan type items
            const availableLoans = this.items.filter(item => item.type === 'loan');
            
            availableLoans.forEach(loan => {
                $loanSelect.append(`
                    <option value="${loan.id}">
                        ${loan.name} (Balance: ${formatCurrency(loan.currentBalance)})
                    </option>
                `);
            });
        },

        calculateAssetEquity: function(asset, atDate = null) {
            if (!asset.associatedLoanId) {
                return asset.currentValue;  // No loan means equity is full value
            }
        
            const associatedLoan = this.items.find(item => item.id === asset.associatedLoanId);
            if (!associatedLoan) {
                console.warn('Associated loan not found for asset:', asset.name);
                return asset.currentValue;
            }
        
            // If calculating equity at purchase date
            if (atDate && atDate === asset.purchaseDate) {
                return this.formatMetricNumber(asset.purchasePrice - associatedLoan.originalAmount);
            }
        
            // For current date or value update dates, get the loan balance at that point
            let loanBalanceAtDate = associatedLoan.originalAmount;
            const dateToCheck = atDate || new Date().toISOString().split('T')[0];
        
            // Calculate loan balance up to this date
            associatedLoan.data
                .filter(trans => trans.date <= dateToCheck)
                .forEach(trans => {
                    if (this.isLoanPayment(trans.description)) {
                        const payment = Math.abs(parseFloat(trans.amount));
                        const interestPaid = (loanBalanceAtDate * (associatedLoan.interestRate / 100)) / 12;
                        const principalPaid = payment - interestPaid;
                        loanBalanceAtDate -= principalPaid;
                    }
                });
        
            return this.formatMetricNumber(asset.currentValue - loanBalanceAtDate);
        },

        calculateAssetEquity: function(asset) {
            if (!asset.associatedLoanId) {
                return asset.currentValue;  // No loan means equity is full value
            }
        
            const associatedLoan = this.items.find(item => item.id === asset.associatedLoanId);
            if (!associatedLoan) {
                console.warn('Associated loan not found for asset:', asset.name);
                return asset.currentValue;
            }
        
            return this.formatMetricNumber(asset.currentValue - associatedLoan.currentBalance);
        },

        // Helper functions for metric calculations
        isInvestmentContribution: function(description) {
            return /initial investment|contribution|deposit|monthly contrib/i.test(description);
        },

        isInvestmentReturn: function(description) {
            return /dividend|return|interest|gain|growth|appreciation|rally|correction|downturn|loss|decline/i.test(description);
        },

        isInvestmentFee: function(description) {
            return /fee|commission|charge|broker|trading/i.test(description);
        },

        isInvestmentWithdrawal: function(description) {
            return /withdrawal|cash out|transfer out/i.test(description);
        },

        isLoanPayment: function(description) { return /payment|loan|principal|interest/i.test(description)
            && !/Initial Loan Amount/i.test(description); 
        },

        isAssetValueChange: function(description) {
            return /value update|revaluation|appraisal/i.test(description);
        },

        calculateVolatility: function(returns) {
            const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
            const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
            return Math.sqrt(squaredDiffs.reduce((sum, d) => sum + d, 0) / returns.length);
        },

        calculateSharpeRatio: function(returns) {
            const riskFreeRate = 0.03; // Assume 3% risk-free rate
            const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
            const volatility = this.calculateVolatility(returns);
            return volatility === 0 ? 0 : (meanReturn - riskFreeRate) / volatility;
        },

        calculateAnnualizedReturn: function(initial, final, years) {
            return years === 0 ? 0 : (Math.pow(final / initial, 1 / years) - 1) * 100;
        },

        calculateRemainingTerm: function(balance, rate, monthlyPayment) {
            const monthlyRate = (rate / 100) / 12;
            return Math.ceil(
                Math.log(monthlyPayment / (monthlyPayment - balance * monthlyRate)) / 
                Math.log(1 + monthlyRate)
            );
        },

        getAverageMonthlyPayment: function(groupedTransactions) {
            const payments = Object.values(groupedTransactions)
                .flatMap(transactions => 
                    transactions
                        .filter(t => this.isLoanPayment(t.description))
                        .map(t => Math.abs(parseFloat(t.amount)))
                );
            return payments.length ? 
                payments.reduce((sum, payment) => sum + payment, 0) / payments.length : 0;
        },

        calculateProjectedPayoffDate: function(balance, rate, monthlyPayment) {
            if (!monthlyPayment) return null;
            const remainingMonths = this.calculateRemainingTerm(balance, rate, monthlyPayment);
            return moment().add(remainingMonths, 'months').format('YYYY-MM-DD');
        },

        calculateEarlyPayoffSavings: function(balance, rate, monthlyPayment) {
            if (!monthlyPayment) return 0;
            const monthlyRate = (rate / 100) / 12;
            const remainingMonths = this.calculateRemainingTerm(balance, rate, monthlyPayment);
            const regularPayoffTotal = monthlyPayment * remainingMonths;
            return regularPayoffTotal - balance;
        },

        getTypeDisplay: function(type) {
            const typeMap = {
                'account': 'Bank Account',
                'credit': 'Credit Card',
                'investment': 'Investment',
                'loan': 'Loan',
                'asset': 'Asset'
            };
            return typeMap[type] || type;
        },

        // Handles chart display on item toggle
        toggleItemVisibility: function(itemId, isVisible) {
            const item = this.items.find(item => item.id === String(itemId));
            if (item) {
                item.isVisible = isVisible;
                this.saveToLocalStorage();
                // Trigger chart update here when implemented
            }
        },

        // Handles item detail editing
        editItem: function(itemId) {
            const item = this.items.find(item => String(item.id) === String(itemId));
            if (!item) return;
            
            // Populate modal fields
            $('#editItemId').val(item.id);
            $('#editItemName').val(item.name);
            $('#editItemColor').text(
                $('#editItemModal .dropdown-item[data-value="' + item.color + '"]').text()
            );
            $('#editItemColorValue').val(item.color);
            
            // Show the modal
            const editModal = new bootstrap.Modal('#editItemModal');
            editModal.show();
        },

        saveEditItem: function() {
            const itemId = $('#editItemId').val();
            const item = this.items.find(item => String(item.id) === String(itemId));
            if (!item) return;
            
            const newName = $('#editItemName').val().trim();
            const newColor = $('#editItemColorValue').val();
            
            if (!newName || !newColor) {
                this.showToast('Please fill in all required fields', 'error');
                return;
            }
            
            item.name = newName;
            item.color = newColor;
            
            this.saveToLocalStorage();
            this.renderItems();
            
            $('#editItemModal').modal('hide');
            this.showToast('Item updated successfully', 'success');
        },

        // Handles opening modal for financial item data entry
        showUpdateDataModal: function(itemId) {
            const item = this.items.find(item => item.id === String(itemId));
            if (!item) return;
        
            this.currentItem = item;
            this.currentPage = 1;
        
            // Update modal title
            $('#updateDataItemName').text(item.name);
        
            // Modify form if it's an asset
            this.modifyManualEntryForAsset(item);
        
            // Initialize entries display
            this.displayEntries();
        
            // Show the modal
            const updateDataModal = new bootstrap.Modal('#updateDataModal');
            updateDataModal.show();
        },

        // Handles financial item entry pagination
        getEntriesPerPage: function() {
            return parseInt($('#entriesPerPage').val()) || 10;
        },

        // Handles formatting of negative values
        formatCurrencyForDisplay: function(value) {
            // Check if the value is negative
            const isNegative = value < 0;
            // Remove the negative sign for formatting
            const absoluteValue = Math.abs(value);
            // Format the value with a dollar sign
            const formattedValue = `$${absoluteValue.toLocaleString()}`;
            // Add the negative sign back if necessary
            return isNegative ? `-${formattedValue}` : formattedValue;
        },
        
        // Handles financial item entry date formatting
        formatDate: function(dateString) {
            // Parse the date components from the dateString
            const dateParts = dateString.split('-'); // Assuming the date string is in 'YYYY-MM-DD' format
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // Months are zero-based in JavaScript
            const day = parseInt(dateParts[2], 10);
            
            // Create a new Date object without any timezone effects
            const localDate = new Date(year, month, day);

            // Format the date to the desired locale
            const formattedDate = localDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            return formattedDate;
        },

        // Handles display of financial item entries
        displayEntries: function() {
            if (!this.currentItem) return;
        
            // Sort entries before displaying
            this.sortEntriesByDate();
        
            const entriesPerPage = this.getEntriesPerPage();
            const startIndex = (this.currentPage - 1) * entriesPerPage;
            const endIndex = startIndex + entriesPerPage;
            const entries = this.currentItem.data.slice(startIndex, endIndex);
        
            // Create table body HTML
            const tableBody = entries.map(entry => {
                let amountDisplay;
                if (this.currentItem.type === 'asset') {
                    // For assets, show the new value and the change
                    const previousEntry = this.findPreviousAssetValue(entry);
                    const previousValue = previousEntry ? previousEntry.amount : this.currentItem.purchasePrice;
                    const valueChange = entry.amount - previousValue;
                    const changeClass = valueChange >= 0 ? 'text-success' : 'text-danger';
                    const changeSymbol = valueChange >= 0 ? '+' : '';
                    
                    amountDisplay = `
                        <div>${formatCurrency(entry.amount)}</div>
                        <small class="${changeClass}">
                            ${changeSymbol}${formatCurrency(valueChange)}
                        </small>
                    `;
                } else {
                    amountDisplay = formatCurrency(entry.amount);
                }
        
                return `
                    <tr>
                        <td>${formatDate(entry.date)}</td>
                        <td>${amountDisplay}</td>
                        <td>${entry.description}</td>
                        <td>
                            <button class="btn btn-sm btn-link text-danger delete-entry" 
                                    data-entry-id="${entry.id}" title="Delete entry">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        
            $('#existingEntriesBody').html(tableBody || `
                <tr>
                    <td colspan="4" class="text-center text-muted">No entries found</td>
                </tr>
            `);
        
            // Update pagination info
            const totalEntries = this.currentItem.data.length;
            $('#startEntry').text(totalEntries ? startIndex + 1 : 0);
            $('#endEntry').text(Math.min(endIndex, totalEntries));
            $('#totalEntries').text(totalEntries);
        
            // Update pagination buttons
            const totalPages = Math.ceil(totalEntries / entriesPerPage);
            $('#prevPage').closest('.page-item').toggleClass('disabled', this.currentPage === 1);
            $('#nextPage').closest('.page-item').toggleClass('disabled', 
                this.currentPage === totalPages || totalEntries === 0);
        },

        // Handles deletion of a financial item entry
        deleteEntry: async function(entryId) {
            if (!this.currentItem) return;
        
            const entryIndex = this.currentItem.data.findIndex(entry => entry.id === String(entryId));
            if (entryIndex === -1) return;
        
            const entry = this.currentItem.data[entryIndex];
            
            const confirmed = await showConfirmation(
                'Delete Entry',
                `Are you sure you want to delete the entry "${entry.description}" from ${formatDate(entry.date)}?`
            );

            if (confirmed) {
                // Remove the entry
                this.currentItem.data.splice(entryIndex, 1);
                
                // Recalculate metrics
                const { metrics, currentBalance, currentValue } = this.calculateMetrics(this.currentItem);
                this.currentItem.metrics = metrics;
                
                // Update balance/value based on item type
                switch(this.currentItem.type) {
                    case 'account':
                        this.currentItem.currentValue = currentValue;
                    case 'loan':
                        this.currentItem.currentBalance = currentBalance;
                        break;
                    case 'investment':
                        this.currentItem.currentValue = currentValue;
                    case 'asset':
                        this.currentItem.currentValue = currentValue;
                        break;
                    case 'credit':
                        this.currentItem.currentBalance = currentBalance;
                        break;
                }
        
                this.saveToLocalStorage();
                
                // If current page is empty after deletion, go to previous page
                const entriesPerPage = this.getEntriesPerPage();
                const totalPages = Math.ceil(this.currentItem.data.length / entriesPerPage);
                if (this.currentPage > totalPages && this.currentPage > 1) {
                    this.currentPage--;
                }
                
                this.displayEntries();
                this.renderItems();
                this.showToast('Entry deleted successfully', 'success');
        
                // Trigger event for other components to update
                $(document).trigger('financialItemsUpdated');
            }
        },

        // Handles deletion of all financial item entries
        clearAllEntries: async function() {
            if (!this.currentItem) return;
            
            const confirmed = await showConfirmation(
                'Clear All Entries',
                `Are you sure you want to delete ALL entries for "${this.currentItem.name}"? This cannot be undone.`
            );
            
            if (confirmed) {
                this.currentItem.data = [];
                this.currentPage = 1;
                this.saveToLocalStorage();
                this.displayEntries();
                this.renderItems();
                this.showToast('All entries cleared successfully', 'success');
            }
        },

        // Handles manual entry of financial item data
        handleManualEntry: function() {
            if (!this.currentItem) return;
        
            const entry = {
                id: Date.now().toString(),
                date: $('#transactionDate').val(),
                amount: parseFloat($('#transactionAmount').val()),
                description: $('#transactionDescription').val().trim()
            };

            // Special handling for asset value updates
            if (this.currentItem.type === 'asset') {
                const newValue = parseFloat($('#transactionAmount').val());
                if (isNaN(newValue) || newValue <= 0) {
                    this.showToast('Please enter a valid asset value', 'error');
                    return;
                }
                entry.amount = newValue;  // For assets, amount represents the new total value
                entry.description = 'Asset Value Update';
            }

            // Validate entry
            if (!this.validateEntry(entry)) return;

            // Add entry to current item's data
            this.currentItem.data.push(entry);
            
            // Sort entries by date
            this.currentItem.data.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Recalculate metrics
            const { metrics, currentValue, currentBalance } = this.calculateMetrics(this.currentItem);
            this.currentItem.metrics = metrics;
            
            // Update balance/value based on item type
            switch(this.currentItem.type) {
                case 'account':
                    this.currentItem.currentValue = currentValue;
                case 'loan':
                    this.currentItem.currentBalance = currentBalance;
                    break;
                case 'investment':
                    this.currentItem.currentValue = currentValue;
                case 'asset':
                    this.currentItem.currentValue = currentValue;
                    break;
                case 'credit':
                    this.currentItem.currentBalance = currentBalance;
                    break;
            }
        
            // Save and update display
            this.saveToLocalStorage();
            this.displayEntries();
            this.renderItems();
            
            // Reset form
            $('#manualEntryForm')[0].reset();
            
            this.showToast(
                this.currentItem.type === 'asset' 
                    ? 'Asset value updated successfully' 
                    : 'Entry added successfully', 
                'success'
            );
        
            // Trigger update event
            $(document).trigger('financialItemsUpdated');
        },

        modifyManualEntryForAsset: function(item) {
            // Modify the form for asset value updates
            const $amountField = $('#transactionAmount');
            const $descriptionField = $('#transactionDescription');
            
            if (item.type === 'asset') {
                // Change amount label
                $amountField.closest('.col-md-4').find('.form-label')
                    .text('New Asset Value');
                
                // Set description placeholder
                $descriptionField.val('Asset Value Update');
                // $descriptionField.closest('.col-md-4').hide();
            } else {
                // Reset form to default state
                $amountField.closest('.col-md-4').find('.form-label')
                    .text('Amount');
                $descriptionField.closest('.col-md-4').show();
            }
        },

        findPreviousAssetValue: function(currentEntry) {
            const currentDate = new Date(currentEntry.date);
            return this.currentItem.data
                .filter(entry => new Date(entry.date) < currentDate)
                .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
        },
        
        // Handles validation for manual financial item data entry
        validateEntry: function(entry) {
            if (!entry.date) {
                this.showToast('Please select a date', 'error');
                return false;
            }
        
            if (isNaN(entry.amount)) {
                this.showToast('Please enter a valid amount', 'error');
                return false;
            }
        
            if (!entry.description) {
                this.showToast('Please enter a description', 'error');
                return false;
            }
        
            // Check if date is not in the future
            if (new Date(entry.date) > new Date()) {
                this.showToast('Date cannot be in the future', 'error');
                return false;
            }
        
            return true;
        },
        
        // Display toast message to the user
        showToast: function(message, type = 'info') {
            // Create toast container if it doesn't exist
            if (!$('#toastContainer').length) {
                $('body').append(`
                    <div id="toastContainer" class="position-fixed bottom-0 end-0 p-3" style="z-index: 1070;">
                    </div>
                `);
            }
        
            // Create unique ID for this toast
            const toastId = 'toast_' + Date.now();
        
            // Create toast HTML
            const toast = $(`
                <div id="${toastId}" class="toast align-items-center border-0 ${type === 'error' ? 'bg-danger' : 'bg-success'} text-white" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="d-flex">
                        <div class="toast-body">
                            ${message}
                        </div>
                        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                </div>
            `);
        
            // Add toast to container
            $('#toastContainer').append(toast);
        
            // Initialize Bootstrap toast and show it
            const bsToast = new bootstrap.Toast(toast[0], {
                autohide: true,
                delay: 3000
            });
            bsToast.show();
        
            // Remove toast element after it's hidden
            toast.on('hidden.bs.toast', function() {
                $(this).remove();
            });
        },

        /* (Working) Papa Parse for sample, original implementation for real data */
        /*
        // Handles previewing of CSV files within a financial item
        previewCSV: function(file) {
            console.log("PreviewCSV called with:", file);
            // Reset state
            this.resetCSVPreview();
            
            // Check if we're using the sample data instead of a file
            if (file === 'sampleFinancialItemsData') {
                console.log("Using sample tour data");
                const data = tourManager.formatTourDataForPreview();
                console.log("Tour data formatted:", data);
                
                // Process tour data directly
                this.csvPreviewData = data;
                this.displayCSVPreview();
                $('#importCsvBtn').prop('disabled', !this.csvPreviewData.length);
            } else {
                // Validate file type
                if (!file.type && !file.name.endsWith('.csv')) {
                    this.showToast('Please upload a CSV file', 'error');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        // Parse CSV content
                        const rows = e.target.result.split('\n')
                            .map(row => row.trim())
                            .filter(row => row) // Remove empty rows
                            .map(row => {
                                // Handle both comma and semicolon delimiters
                                const delimiter = row.includes(';') ? ';' : ',';
                                return row.split(delimiter).map(cell => cell.trim());
                            });

                        if (rows.length < 2) { // Need at least header and one data row
                            throw new Error('CSV file appears to be empty or invalid');
                        }

                        // Store preview data
                        this.csvPreviewData = this.processCSVRows(rows);
                        
                        // Show preview
                        this.displayCSVPreview();
                        
                        // Enable/disable import button
                        $('#importCsvBtn').prop('disabled', !this.csvPreviewData.length);

                    } catch (error) {
                        this.showToast(`Error reading CSV: ${error.message}`, 'error');
                        this.resetCSVPreview();
                    }
                };

                reader.onerror = () => {
                    this.showToast('Error reading the file', 'error');
                    this.resetCSVPreview();
                };

                reader.readAsText(file);
            }
        }, */

        /* (Working) Papa Parse for both sample and real data */
        // Handles previewing of CSV files within a financial item
        previewCSV: function(file) {
            this.resetCSVPreview();
            
            if (file === 'sampleFinancialItemsData') {
                const data = tourManager.formatTourDataForPreview();
                this.csvPreviewData = data;
                this.displayCSVPreview();
                $('#importCsvBtn').prop('disabled', !this.csvPreviewData.length);
            } else {
                // Handle real file upload
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        Papa.parse(e.target.result, {
                            header: false,
                            dynamicTyping: false,
                            skipEmptyLines: true,
                            complete: (results) => {
                                if (results.data.length < 2) {
                                    throw new Error('CSV file appears to be empty or invalid');
                                }
                                this.csvPreviewData = this.processCSVRows(results.data);
                                this.displayCSVPreview();
                                $('#importCsvBtn').prop('disabled', !this.csvPreviewData.length);
                            },
                            error: (error) => {
                                console.error('Error parsing CSV:', error);
                                this.showToast('Error parsing CSV file', 'error');
                                this.resetCSVPreview();
                            }
                        });
                    } catch (error) {
                        console.error('Error reading CSV:', error);
                        this.showToast(`Error reading CSV: ${error.message}`, 'error');
                        this.resetCSVPreview();
                    }
                };
        
                reader.onerror = () => {
                    this.showToast('Error reading the file', 'error');
                    this.resetCSVPreview();
                };
        
                reader.readAsText(file);
            }
        },

        // Handles parsing of dates in uploaded CSVs
        parseDate: function(dateStr) {
            const date = moment(dateStr);
            if (!date.isValid()) {
                // Try some specific formats that moment might not catch automatically
                const formats = [
                    'DD/MM/YYYY', 'DD-MM-YYYY', 'DD.MM.YYYY',
                    'MM/DD/YYYY', 'MM-DD-YYYY', 'MM.DD.YYYY',
                    'DD/MM/YY', 'DD-MM-YY', 'DD.MM.YY',
                    'MM/DD/YY', 'MM-DD-YY', 'MM.DD.YY'
                ];
                
                for (let format of formats) {
                    if (moment(dateStr, format, true).isValid()) {
                        return moment(dateStr, format).toDate();
                    }
                }
                throw new Error(`Unable to parse date: ${dateStr}`);
            }
            return date.toDate();
        },

        // Handles parsing of values in uploaded CSVs
        parseAmount: function(amountStr) {
            // Remove any whitespace
            amountStr = amountStr.trim();
            
            // Handle parentheses for negative numbers (common in accounting)
            if (amountStr.startsWith('(') && amountStr.endsWith(')')) {
                amountStr = '-' + amountStr.slice(1, -1);
            }
            
            // Remove any currency symbols and thousand separators
            amountStr = amountStr.replace(/[^0-9.-]/g, '');
            
            // Parse the number
            const amount = parseFloat(amountStr);
            if (isNaN(amount)) {
                throw new Error(`Unable to parse amount: ${amountStr}`);
            }
            
            return amount;
        },

        // Handles processing of rows in uploaded CSVs
        processCSVRows: function(rows) {
            const processedData = [];
            const headerRow = rows[0].map(header => header.toLowerCase().trim());

            // Try to find our required columns with some flexibility
            const dateIndex = headerRow.findIndex(h => 
                h.includes('date') || h.includes('time') || h.includes('when'));
            const amountIndex = headerRow.findIndex(h => 
                h.includes('amount') || h.includes('sum') || h.includes('value') || 
                h.includes('debit') || h.includes('credit'));
            const descriptionIndex = headerRow.findIndex(h => 
                h.includes('desc') || h.includes('narration') || h.includes('details') || 
                h.includes('transaction') || h.includes('note'));

            if (dateIndex === -1 || amountIndex === -1 || descriptionIndex === -1) {
                throw new Error('Could not identify required columns. Please ensure your CSV has columns for date, amount, and description.');
            }

            // Process data rows
            let errorLog = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row.length || row.every(cell => !cell.trim())) continue; // Skip empty rows

                try {
                    // Parse date with flexible format
                    const date = this.parseDate(row[dateIndex]);
                    
                    // Parse amount with flexible format
                    const amount = this.parseAmount(row[amountIndex]);

                    // Clean up description
                    const description = (row[descriptionIndex] || 'No description').trim();

                    processedData.push({
                        id: Date.now().toString() + i, // Ensure unique ID
                        date: date.toISOString().split('T')[0], // Format as YYYY-MM-DD
                        amount: amount,
                        description: description
                    });
                } catch (error) {
                    errorLog.push(`Row ${i + 1}: ${error.message}`);
                }
            }

            // Show errors if any, but don't prevent import of valid rows
            if (errorLog.length > 0) {
                const skippedRows = errorLog.length;
                const successRows = processedData.length;
                this.showToast(
                    `Processed ${successRows} rows successfully. Skipped ${skippedRows} invalid rows.`,
                    'info'
                );
            }
        
            // Sort the processed data chronologically before returning
            processedData.sort((a, b) => {
                const dateA = moment(a.date).startOf('day');
                const dateB = moment(b.date).startOf('day');
                return dateA - dateB;
            });
        
            return processedData;
        },

        // Handles display of CSV file uploads within a financial item
        displayCSVPreview: function() {
            if (!this.csvPreviewData || !this.csvPreviewData.length) {
                this.resetCSVPreview();
                return;
            }
        
            const previewHtml = this.csvPreviewData
                .slice(0, 10) // Show first 10 rows instead of 5
                .map(entry => `
                    <tr>
                        <td>${formatDate(entry.date)}</td>
                        <td>${formatCurrency(entry.amount)}</td>
                        <td>${entry.description}</td>
                    </tr>
                `).join('');
        
            $('#csvPreviewBody').html(previewHtml);
        
            if (this.csvPreviewData.length > 10) { // Update this check too
                $('#csvPreviewBody').append(`
                    <tr>
                        <td colspan="3" class="text-muted text-center">
                            ... and ${this.csvPreviewData.length - 10} more entries
                        </td>
                    </tr>
                `);
            }
        },

        // Handles reset of CSV file preview within a financial item
        resetCSVPreview: function() {
            this.csvPreviewData = [];
            $('#csvPreviewBody').html(`
                <tr>
                    <td colspan="3" class="text-muted text-center">
                        Upload a CSV file to preview data
                    </td>
                </tr>
            `);
            $('#importCsvBtn').prop('disabled', true);
            $('#csvFile').val('');
        },

        // Handles import of CSV data to storage
        importCSVData: function() {
            if (!this.currentItem || !this.csvPreviewData || !this.csvPreviewData.length) {
                return;
            }
        
            try {
                // Add new entries to existing data
                this.currentItem.data = [
                    ...this.currentItem.data,
                    ...this.csvPreviewData
                ];
        
                // Sort all entries by date
                this.sortEntriesByDate();
        
                // Recalculate metrics
                const { metrics, currentBalance, currentValue } = this.calculateMetrics(this.currentItem);
                this.currentItem.metrics = metrics;
                
                // Update balance/value based on item type
                switch(this.currentItem.type) {
                    case 'account':
                        this.currentItem.currentValue = currentValue;
                    case 'loan':
                        this.currentItem.currentBalance = currentBalance;
                        break;
                    case 'investment':
                        this.currentItem.currentValue = currentValue;
                    case 'asset':
                        this.currentItem.currentValue = currentValue;
                        break;
                    case 'credit':
                        this.currentItem.currentBalance = currentBalance;
                        break;
                }
        
                // Save and update display
                this.saveToLocalStorage();
                this.displayEntries();
                this.renderItems();
        
                // Reset CSV upload
                this.resetCSVPreview();
                
                // Show success message
                this.showToast(`Successfully imported ${this.csvPreviewData.length} entries`, 'success');
        
                // Switch to manual entry tab
                const manualEntryTab = document.querySelector('[data-bs-target="#manualEntry"]');
                const tab = new bootstrap.Tab(manualEntryTab);
                tab.show();
        
                // Trigger event for other components to update
                $(document).trigger('financialItemsUpdated');
        
            } catch (error) {
                this.showToast(`Error importing data: ${error.message}`, 'error');
            }
        },
        
        // Handles sorting of CSV entries by date
        sortEntriesByDate: function() {
            if (!this.currentItem || !this.currentItem.data) return;
        
            this.currentItem.data.sort((a, b) => {
                // Convert strings to Date objects for comparison
                const dateA = moment(a.date).startOf('day');
                const dateB = moment(b.date).startOf('day');
        
                // Sort in chronological order (oldest to newest)
                return dateA - dateB;
            });
        },

        // Handles creation of a new financial item
        saveNewItem: function() {
            const itemName = $('#itemName').val();
            const itemType = $('#itemTypeValue').val();
            const itemColor = $('#itemColorValue').val();

            if (!itemName || !itemType || !itemColor) {
                this.showToast('Please fill in all required fields', 'error');
                return;
            }
        
            // Create base item structure
            const newItem = {
                id: Date.now().toString(),
                name: itemName,
                type: itemType,
                color: itemColor,
                isVisible: true,
                data: [],
                metrics: []
            };

            try {
                // Add type-specific properties and initial transaction
                switch(itemType) {
                    case 'account':
                        const accountValue = parseFloat($('#initialBalance').val());
                        const accountDate = $('#accountStartDate').val();
                        if (!accountDate) throw new Error('Start date is required for bank accounts');
                        if (isNaN(accountValue)) throw new Error('Valid initial balance is required for bank accounts');
        
                        newItem.currentValue = accountValue;
                        newItem.data.push({
                            id: Date.now().toString() + '_initial',
                            date: accountDate,
                            amount: accountValue,
                            description: 'Initial Balance'
                        });
                        break;
        
                    case 'credit':
                        const creditLimit = parseFloat($('#creditLimit').val());
                        const creditBalance = parseFloat($('#creditInitialBalance').val());
                        const creditDate = $('#creditStartDate').val();
                        const creditRate = parseFloat($('#creditInterestRate').val());
                        
                        if (!creditDate) throw new Error('Start date is required for credit cards');
                        if (isNaN(creditLimit)) throw new Error('Credit limit is required');
                        if (isNaN(creditBalance)) throw new Error('Initial balance is required for credit cards');
                        if (isNaN(creditRate)) throw new Error('Interest rate is required for credit cards');

                        const processedCredit = this.processCreditCardAmount(creditBalance, true);
                        
                        newItem.creditLimit = creditLimit;
                        newItem.interestRate = creditRate;
                        newItem.currentBalance = processedCredit.plottedAmount;
                        newItem.data.push({
                            id: Date.now().toString() + '_initial',
                            date: creditDate,
                            amount: processedCredit.storedAmount,
                            description: 'Initial Balance'
                        });
                        break;
        
                    case 'investment':
                        const investAmount = parseFloat($('#initialInvestment').val());
                        const investDate = $('#investmentStartDate').val();
                        
                        if (!investDate) throw new Error('Start date is required for investments');
                        if (isNaN(investAmount)) throw new Error('Initial investment amount is required');
        
                        newItem.initialInvestment = investAmount;
                        newItem.currentValue = investAmount;
                        newItem.data.push({
                            id: Date.now().toString() + '_initial',
                            date: investDate,
                            amount: investAmount,
                            description: 'Initial Investment'
                        });
                        break;
        
                    case 'loan':
                        const loanAmount = parseFloat($('#loanAmount').val());
                        const loanDate = $('#loanStartDate').val();
                        const loanRate = parseFloat($('#loanInterestRate').val());
                        const paymentAmount = parseFloat($('#loanPaymentAmount').val());
                        const paymentFrequency = $('#loanPaymentFrequency').val();
                        
                        if (!loanDate) throw new Error('Start date is required for loans');
                        if (isNaN(loanAmount)) throw new Error('Loan amount is required');
                        if (isNaN(loanRate)) throw new Error('Interest rate is required for loans');

                        newItem.originalAmount = loanAmount;
                        newItem.interestRate = loanRate;
                        newItem.currentBalance = loanAmount;
                        newItem.paymentAmount = paymentAmount || null;
                        newItem.paymentFrequency = paymentFrequency || null;
                        
                        // Add initial balance entry
                        newItem.data.push({
                            id: Date.now().toString() + '_initial',
                            date: loanDate,
                            amount: loanAmount,
                            description: 'Initial Loan Amount'
                        });

                        // Generate scheduled payments if payment details provided
                        if (paymentAmount && paymentFrequency) {
                            const scheduledPayments = this.generateLoanPayments(
                                loanDate,
                                moment().format('YYYY-MM-DD'),
                                paymentAmount,
                                paymentFrequency
                            );
                            
                            // Add each scheduled payment with unique ID
                            scheduledPayments.forEach(payment => {
                                newItem.data.push({
                                    id: Date.now().toString() + '_' + payment.date,
                                    date: payment.date,
                                    amount: payment.amount,
                                    description: 'Scheduled Loan Payment'
                                });
                            });
                        }
                        break;

                    case 'asset':
                        const assetPrice = parseFloat($('#assetPurchasePrice').val());
                        const assetDate = $('#assetPurchaseDate').val();
                        const assetLoanId = $('#assetLoan').val() || null;
                        
                        if (!assetDate) throw new Error('Purchase date is required for assets');
                        if (isNaN(assetPrice)) throw new Error('Purchase price is required for assets');
        
                        newItem.purchasePrice = assetPrice;
                        newItem.currentValue = assetPrice;
                        newItem.purchaseDate = assetDate;
                        newItem.associatedLoanId = assetLoanId;
                        newItem.data.push({
                            id: Date.now().toString() + '_initial',
                            date: assetDate,
                            amount: assetPrice,
                            description: 'Initial Asset Value'
                        });
                        break;
                }

                const { metrics, currentValue, currentBalance } = this.calculateMetrics(newItem);
                newItem.metrics = metrics;
                if (newItem.type === ('account' || 'investment' || 'asset')) {
                    newItem.currentValue = currentValue;
                } else {
                    newItem.currentBalance = currentBalance;
                }

                // Add the new item
                this.items.push(newItem);
                this.saveToLocalStorage();
                this.renderItems();
        
                // Reset form and close modal
                $('#addItemModal').modal('hide');
                $('#addItemForm')[0].reset();
                $('#itemType').text('Select type...');
                $('#itemColor').text('Select color...');
                $('#colorPreview').css('background-color', '');
                $('#itemTypeValue, #itemColorValue').val('');
                $('#typeSpecificFields').hide();
                
                this.showToast('Financial item added successfully', 'success');
        
            } catch (error) {
                this.showToast(error.message, 'error');
                return;
            }
        },

        formatMetricNumber: function(number, decimals = 2) {
            return Number(parseFloat(number).toFixed(decimals));
        },
        
        formatMetricsObject: function(metricsObj) {
            const formatValue = (value) => {
                if (typeof value === 'number') {
                    return this.formatMetricNumber(value);
                }
                if (typeof value === 'object' && value !== null) {
                    return this.formatMetricsObject(value);
                }
                return value;
            };
        
            if (Array.isArray(metricsObj)) {
                return metricsObj.map(formatValue);
            }
        
            return Object.entries(metricsObj).reduce((acc, [key, value]) => {
                acc[key] = formatValue(value);
                return acc;
            }, {});
        },

        // Handles deletion of a financial item
        deleteItem: async function(itemId) {
            // Identify item for deletion
            const item = this.items.find(item => {
                const itemIdString = String(itemId);
                return item.id === itemIdString;
            });
            
            const confirmed = await showConfirmation(
                'Delete Item',
                `Are you sure you want to delete "${item.name}"? This will remove all associated data and cannot be undone.`
            );

            // Delete the item after user confirmation
            if (item && confirmed) {
                this.items = this.items.filter(i => i.id !== String(itemId));
                this.saveToLocalStorage();
                this.renderItems();
                return true;
            }
        },
        
        // Saves financial items to local storage
        saveToLocalStorage: function() {
            localStorage.setItem('financialItems', JSON.stringify(this.items));
        },

        // Displays financial items in the sidebar
        renderItems: function() {
            const savedOrder = JSON.parse(localStorage.getItem('financialItemsOrder'));
            
            const orderedItems = savedOrder 
                ? [...this.items].sort((a, b) => {
                    const aIndex = savedOrder.indexOf(String(a.id));
                    const bIndex = savedOrder.indexOf(String(b.id));
                    
                    if (aIndex !== -1 && bIndex !== -1) {
                        return aIndex - bIndex;
                    }
                    if (aIndex === -1) return 1;
                    if (bIndex === -1) return -1;
                    return 0;
                })
                : this.items;

                const itemsHtml = orderedItems.map(item => {
                    return this.createItemHtml(item)
                }).join('');
        
            $('#financialItemsList').html(itemsHtml || '<p class="text-muted">No financial items added yet</p>');
        
            // Update chart whenever items are rendered
            if (window.chartManager) {
                chartManager.updateChart();
            }

            // Update metrics cards
            if (window.metricsManager) {
                metricsManager.updateMetrics();
            }
        },

        createItemHtml: function(item) {
            return this.createFinancialItemCard(item);
        },
        
        createFinancialItemCard: function(item) {
            const detailsHtml = this.createItemDetailsHtml(item);
            
            return `
                <div class="financial-item" data-item-id="${item.id}">
                    <div class="financial-item-header">
                        <div class="d-flex align-items-center flex-grow-1">
                            <span class="color-preview" style="background-color: ${item.color}"></span>
                            <div class="d-flex justify-content-between align-items-center flex-grow-1">
                                <h6 class="financial-item-title mb-0">${item.name}</h6>
                                <div class="d-flex align-items-center">
                                    <button class="btn btn-sm edit-item-btn" title="Edit item">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm delete-item-btn" title="Delete item">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                    <label class="toggle-switch ms-2">
                                        <input type="checkbox" class="toggle-input" ${item.isVisible ? 'checked' : ''}>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="financial-item-body">
                        <small class="text-muted d-block mb-2">${this.getTypeDisplay(item.type)}</small>
                        ${detailsHtml}
                        <button class="btn btn-sm btn-outline-primary update-data-btn mt-2">
                            <i class="fas fa-upload me-1"></i>Update Data
                        </button>
                    </div>
                </div>
            `;
        },
        
        createItemDetailsHtml: function(item) {
            // Creates the details HTML for each type of financial item
            switch(item.type) {
                case 'account':
                    return this.createAccountDetailsHtml(item);
                case 'credit':
                    return this.createCreditDetailsHtml(item);
                case 'investment':
                    return this.createInvestmentDetailsHtml(item);
                case 'loan':
                    return this.createLoanDetailsHtml(item);
                case 'asset':
                    return this.createAssetDetailsHtml(item);
                default:
                    return '';
            }
        },

        createAccountDetailsHtml: function(item) {
            return `
                <div class="financial-item-details">
                    <div class="detail-row">
                        <span class="detail-label">Current Balance:</span>
                        <span class="detail-value">${formatCurrency(item.currentValue)}</span>
                    </div>
                    <div class="collapse-details collapse" id="details-${item.id}">
                        ${this.getMonthlyChangeHtml(item)}
                    </div>
                    <button class="btn btn-link toggle-details px-0 mt-2 collapsed" 
                            data-bs-toggle="collapse" 
                            data-bs-target="#details-${item.id}" 
                            aria-expanded="false">
                        <i class="fas fa-chevron-down"></i>
                        <span class="ms-1">Show Details</span>
                    </button>
                </div>`;
        },

        createCreditDetailsHtml: function(item) {
            const utilization = ((item.currentBalance / item.creditLimit) * 100).toFixed(1);
            return `
                <div class="financial-item-details">
                    <div class="detail-row">
                        <span class="detail-label">Current Balance:</span>
                        <span class="detail-value">${formatCurrency(item.currentBalance)}</span>
                    </div>
                    <div class="collapse-details collapse" id="details-${item.id}" >
                        <div class="detail-row">
                            <span class="detail-label">Credit Limit:</span>
                            <span class="detail-value">${formatCurrency(item.creditLimit)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Utilization:</span>
                            <span class="detail-value">${utilization}%</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Interest Rate:</span>
                            <span class="detail-value">${item.interestRate}%</span>
                        </div>
                    </div>
                    <button class="btn btn-link toggle-details px-0 mt-2 collapsed" 
                            data-bs-toggle="collapse" 
                            data-bs-target="#details-${item.id}" 
                            aria-expanded="false">
                        <i class="fas fa-chevron-down"></i>
                        <span class="ms-1">Show Details</span>
                    </button>
                </div>`;
        },

        createInvestmentDetailsHtml: function(item) {
            const annualizedReturnPercent = item.metrics?.performance?.annualizedReturn || 0;
            const totalReturnPercent = item.metrics?.performance?.totalReturnPercentage || 0;
            const totalContributions = item.metrics?.performance?.totalContributions || 0;
            const totalReturn = item.metrics?.performance?.totalReturns || 0;
            
            return `
                <div class="financial-item-details">
                    <div class="detail-row">
                        <span class="detail-label">Current Value:</span>
                        <span class="detail-value">${formatCurrency(item.currentValue)}</span>
                    </div>
                    <div class="collapse-details collapse" id="details-${item.id}">
                        <div class="detail-row">
                            <span class="detail-label">Contributions:</span>
                            <span class="detail-value">${formatCurrency(totalContributions)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Gains:</span>
                            <span class="detail-value">${formatCurrency(totalReturn)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Annual Return:</span>
                            <span class="detail-value ${annualizedReturnPercent >= 0 ? 'text-success' : 'text-danger'}">
                                ${annualizedReturnPercent >= 0 ? '+' : ''}${annualizedReturnPercent.toFixed(2)}%
                            </span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Total Return:</span>
                            <span class="detail-value ${totalReturnPercent >= 0 ? 'text-success' : 'text-danger'}">
                                ${totalReturnPercent >= 0 ? '+' : ''}${totalReturnPercent.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                    <button class="btn btn-link toggle-details px-0 mt-2 collapsed" 
                            data-bs-toggle="collapse" 
                            data-bs-target="#details-${item.id}" 
                            aria-expanded="false">
                        <i class="fas fa-chevron-down"></i>
                        <span class="ms-1">Show Details</span>
                    </button>
                </div>`;
        },

        createLoanDetailsHtml: function(item) {
            const interestPaid = item.metrics?.summary?.totalInterestPaid || 0;
            const totalPaid = item.metrics?.summary?.totalPaidToDate || 0;
            const principalPaid = totalPaid - interestPaid;
            const projectedPayoff = item.metrics?.summary?.projectedPayoffDate || 0;

            return `
                <div class="financial-item-details">
                    <div class="detail-row">
                        <span class="detail-label">Remaining Balance:</span>
                        <span class="detail-value">${formatCurrency(item.currentBalance)}</span>
                    </div>
                    <div class="collapse-details collapse" id="details-${item.id}">
                        <div class="detail-row">
                            <span class="detail-label">Original Amount:</span>
                            <span class="detail-value">${formatCurrency(item.originalAmount)}</span>
                        </div>    
                        <div class="detail-row">
                            <span class="detail-label">Principal Paid:</span>
                            <span class="detail-value">${formatCurrency(principalPaid)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Interest Paid:</span>
                            <span class="detail-value">${formatCurrency(interestPaid)}</span>
                        </div>               
                        <div class="detail-row">
                            <span class="detail-label">Total Paid:</span>
                            <span class="detail-value">${formatCurrency(totalPaid)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Interest Rate:</span>
                            <span class="detail-value">${item.interestRate}%</span>
                        </div>          
                        <div class="detail-row">
                            <span class="detail-label">Projected Payoff Date:</span>
                            <span class="detail-value">${projectedPayoff}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Progress:</span>
                            <div class="progress loan-progress">
                                <div class="progress-bar" role="progressbar" 
                                    style="width: ${((1 - (item.currentBalance / item.originalAmount)) * 100).toFixed(1)}%">
                                </div>
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-link toggle-details px-0 mt-2 collapsed" 
                            data-bs-toggle="collapse" 
                            data-bs-target="#details-${item.id}" 
                            aria-expanded="false">
                        <i class="fas fa-chevron-down"></i>
                        <span class="ms-1">Show Details</span>
                    </button>
                </div>`;
        },

        createAssetDetailsHtml: function(item) {
            const equity = item.associatedLoanId ? item.metrics?.summary?.currentEquity : item.currentValue;
            const totalAppreciation = item.metrics?.summary?.totalAppreciation || 0;
            const appreciationPercent = item.metrics?.summary?.totalAppreciationPercent || 0;

            return `
                <div class="financial-item-details">
                    <div class="detail-row">
                        <span class="detail-label">Current Value:</span>
                        <span class="detail-value">${formatCurrency(item.currentValue)}</span>
                    </div>
                    <div class="collapse-details collapse" id="details-${item.id}">
                        <div class="detail-row">
                            <span class="detail-label">Purchase Price:</span>
                            <span class="detail-value">${formatCurrency(item.purchasePrice)}</span>
                        </div>
                        ${!item.associatedLoanId ? '' : 
                            `<div class="detail-row">
                                <span class="detail-label">Outstanding Loan Balance:</span>
                                <span class="detail-value">${formatCurrency(item.currentValue - equity)}</span>
                            </div>`
                        }
                        <div class="detail-row">
                            <span class="detail-label">Current Equity:</span>
                            <span class="detail-value">${this.formatCurrencyForDisplay(equity)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Total Appreciation:</span>
                            <span class="detail-value">${this.formatCurrencyForDisplay(totalAppreciation)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Appreciation Percent:</span>
                            <span class="detail-value ${appreciationPercent >= 0 ? 'text-success' : 'text-danger'}">
                                ${appreciationPercent >= 0 ? '+' : ''}${appreciationPercent.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                    <button class="btn btn-link toggle-details px-0 mt-2 collapsed" 
                            data-bs-toggle="collapse" 
                            data-bs-target="#details-${item.id}" 
                            aria-expanded="false">
                        <i class="fas fa-chevron-down"></i>
                        <span class="ms-1">Show Details</span>
                    </button>
                </div>`;
        },

        // Helper function to get monthly change HTML
        getMonthlyChangeHtml: function(item) {
            const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
            const monthlyChange = item.metrics?.monthly[currentMonth]?.netChange || 0;
            
            return `
                <div class="detail-row">
                    <span class="detail-label">Monthly Change:</span>
                    <span class="detail-value ${monthlyChange >= 0 ? 'text-success' : 'text-danger'}">
                        ${monthlyChange >= 0 ? '+' : ''}${formatCurrency(monthlyChange)}
                    </span>
                </div>`;
        },

        reset: function() {
            // Clear data
            this.items = [];
            
            // Reset form states
            $('#addItemForm')[0].reset();
            $('#editItemForm')[0].reset();
            
            // Reset dropdowns
            $('#itemType, #itemColor').text('Select type...');
            $('#editItemColor').text('Select color...');
            
            // Reset color previews
            $('#colorPreview').css('background-color', '');
            
            // Reset hidden inputs
            $('#itemTypeValue, #itemColorValue, #editItemColorValue').val('');
            
            // Hide type-specific fields
            $('#typeSpecificFields').hide();
            $('.type-field').hide();
            
            // Close modals
            $('#addItemModal, #editItemModal').modal('hide');
            
            // Update UI
            this.renderItems();
        }
    };
/* FINANCIAL ITEMS MANAGER CONSTRUCTOR ENDS */


/* CHART MANAGER CONSTRUCTOR STARTS */
    /* CHART INITIALIZATION CODE */
    const chartManager = {
        chart: null,
        
        init: function() {
            // Remove all existing bindings for this manager before reinitializing
            $(document).off('.chartManager');
            $('body').off('.chartManager');

            if (this.chart) {
                this.chart.destroy();
            }
            this.initChart();
            this.updateChart();
            this.bindEvents();
            // Add a slight delay to allow the chart to fully initialize
            setTimeout(() => {
                this.updateChart();
            }, 100);
        },
    
        // Handle event bindings
        bindEvents: function() {        
            // Handle view type changes
            $('input[name="viewtype"]').on('change.chartManager', (e) => {
                const selectedView = e.target.id.replace('view', '').toLowerCase();
                // Will implement view switching later
            });

            // Handle light/dark theme changes
            $('#darkModeToggle').on('click.chartManager', () => {
                setTimeout(() => {  // Give time for theme to update
                    this.updateChartTheme();
                }, 0);
            });

            // Handle zoom control
            $('#zoomIn').on('click.chartManager', () => {
                this.handleZoom('in');
            });
            
            $('#zoomOut').on('click.chartManager', () => {
                this.handleZoom('out');
            });
            
            $('#zoomReset').on('click.chartManager', () => {
                this.resetZoom();
            });

            // Add handler for closing financial item overlay
            $('.financial-item-overlay-close').on('click.chartManager', () => {
                this.hideFinancialItemOverlay();
            });

            // Close overlay when clicking outside the content
            $('.financial-item-overlay').on('click.chartManager', (e) => {
                if ($(e.target).hasClass('financial-item-overlay')) {
                    this.hideFinancialItemOverlay();
                }
            });

            // Close overlay with escape key
            $(document).on('keydown.chartManager', (e) => {
                if (e.key === 'Escape' && $('.financial-item-overlay').hasClass('active')) {
                    this.hideFinancialItemOverlay();
                }
            });

            // Add click handler for the chart
            $('#financialChart').on('click.chartManager', (evt) => {
                const points = this.chart.getElementsAtEventForMode(
                    evt,
                    'nearest',
                    { intersect: true },
                    true
                );

                // Increase buffer for clickable point area
                function isPointInRadius(point, evt, radius) {
                    const mouseX = evt.offsetX;
                    const mouseY = evt.offsetY;
                    const x = point.element.x;
                    const y = point.element.y;
                    const distance = Math.sqrt((mouseX - x) * (mouseX - x) + (mouseY - y) * (mouseY - y));
                    return distance <= radius;
                }

                // Add a 20px buffer around each point
                const bufferedPoints = points.filter(point => isPointInRadius(point, evt, 20));

                if (bufferedPoints.length) {
                    // Data point was clicked
                    const firstPoint = points[0];
                    const datasetIndex = firstPoint.datasetIndex;
                    const index = firstPoint.index;
                    const dataset = this.chart.data.datasets[datasetIndex];
                    const clickedData = dataset.data[index];
                    
                    // Check if clicked point is a goal
                    if (dataset.label === 'Goals') {
                        const goalId = dataset.data[firstPoint.index].goalId;
                        this.showGoalOverlay(goalId, evt);
                        return;
                    } else if (dataset.label === 'Milestones') {
                        const milestoneId = dataset.data[firstPoint.index].milestoneId;
                        const milestone = milestoneManager.milestones.find(m => m.id === milestoneId);
                        if (milestone) {
                            milestoneManager.showMilestoneDetails(milestone, evt);
                        }
                        return;
                    }

                    // If not a goal or milestone, find the corresponding financial item
                    const item = financialItemsManager.items.find(i => i.name === dataset.label);
                    if (!item) return;
                        // Open update modal and scroll to date
                        this.openUpdateModalAtDate(item.id, clickedData.date);
                    }
            });

            // Add handlers for the add action modal
            $('#actionType').on('change.chartManager', function() {
                $('#actionContinueBtn').prop('disabled', !$(this).val());
            });

            $('#actionContinueBtn').on('click.chartManager', function() {
                const actionType = $('#actionType').val();
                const addActionModal = bootstrap.Modal.getInstance('#addActionModal');
                
                $('#addActionModal').find(':focus').blur();
                addActionModal.hide();
                
                switch(actionType) {
                    case 'financial':
                        const addItemModal = new bootstrap.Modal('#addItemModal');
                        addItemModal.show();
                        break;
                        
                    case 'goal':
                        const addGoalModal = new bootstrap.Modal('#addGoalModal');
                        addGoalModal.show();
                        break;
                        
                    case 'milestone':
                        const addMilestoneModal = new bootstrap.Modal('#addMilestoneModal');
                        addMilestoneModal.show();
                        break;
                }
            });

            // Reset action type when modal is closed
            $('#addActionModal').off().on('hidden.bs.modal.chartManager', function() {
                $('#actionType').val('');
                $('#actionContinueBtn').prop('disabled', true);
            });

            // Add handler for closing goal overlay
            $('.goal-overlay-close').on('click.chartManager', () => {
                this.hideGoalOverlay();
            });

            // Close overlay when clicking outside the content
            $('.goal-overlay').on('click.chartManager', (e) => {
                if ($(e.target).hasClass('goal-overlay')) {
                    this.hideGoalOverlay();
                }
            });

            // Close overlay with escape key
            $(document).on('keydown.chartManager', (e) => {
                if (e.key === 'Escape' && $('.goal-overlay').hasClass('active')) {
                    this.hideGoalOverlay();
                }
            });
        },
    
        // Initialize chart with new configuration
        initChart: function() {          
            const ctx = document.getElementById('financialChart').getContext('2d');
            const isDarkMode = $('html').attr('data-theme') === 'dark';
            
            const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
            const textColor = isDarkMode ? '#f8f9fa' : '#666';
            
            // Get initial date range
            const dateRange = this.getDateRange();

            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: []
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    spanGaps: true,
                    normalized: true,
                    parsing: false,
                    animation: false,
                    elements: {
                        point: {
                            pointStyle: function(context) {
                                // Check if this is a goal point
                                const dataset = context.dataset;
                                if (dataset.label === 'Goals') {
                                    return 'star';
                                } else if (dataset.label === 'Milestones') {
                                    return 'rectRot';  // This creates a diamond shape which can look like a trophy
                                }
                                // Default point style for other datasets
                                return 'circle';
                            },
                            radius: function(context) {
                                // Make goal points bigger than regular data points
                                return context.dataset.label === 'Goals' ? 12 : 3;
                            },
                            hoverRadius: function(context) {
                                return context.dataset.label === 'Goals' ? 15 : 5;
                            }
                        },
                        line: {
                            tension: 0.3
                        }
                    },
                    interaction: {
                        intersect: true,
                        mode: 'point'
                    },
                    plugins: {
                        legend: {
                            labels: {
                                usePointStyle: true
                            },
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    if (context.dataset.label === 'Goals') {
                                        return `Goal: ${context.raw.y.toLocaleString('en-US', {
                                            style: 'currency',
                                            currency: 'USD'
                                        })}`;
                                    }
                                    return `${context.dataset.label}: ${context.raw.y.toLocaleString('en-US', {
                                        style: 'currency',
                                        currency: 'USD'
                                    })}`;
                                }
                            }
                        },
                        decimation: {
                            enabled: true,
                            algorithm: 'lttb',
                            samples: 20,   // How many sample points to include when data is decimated
                            threshold: 50, // how many points must be in the dataset for decimation to trigger
                            force: true,
                            rate: 2
                        },
                        zoom: {
                            pan: {
                                enabled: true,
                                mode: 'x',
                                rangeMin: {
                                    x: dateRange.start.getTime()
                                },
                                onPan: ({ chart }) => {
                                    const range = chartManager.calculateVisibleRange();
                                    chart.scales.y.options.min = range.min;
                                    chart.scales.y.options.max = range.max;
                                    chartManager.updateMarkers();
                                    chart.update('none');
                                }
                            },
                            limits: {
                                x: {
                                    min: dateRange.start.getTime(),
                                }
                            },
                            zoom: {
                                wheel: {
                                    enabled: true,
                                    speed: 0.1
                                },
                                drag: {
                                    enabled: false,
                                    backgroundColor: 'rgba(225,225,225,0.3)'
                                },
                                mode: 'x',
                                rangeMin: {
                                    x: dateRange.start.getTime()
                                },
                                onZoom: ({ chart }) => {
                                    const range = chartManager.calculateVisibleRange();
                                    chart.scales.y.options.min = range.min;
                                    chart.scales.y.options.max = range.max;
                                    chartManager.updateMarkers();
                                    chart.update('none');
                                }
                            }
                        },
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'month',
                                displayFormats: {
                                    month: 'MMM yyyy'
                                }
                            },
                            ticks: {
                                source: 'auto',
                                autoSkip: true,
                                maxRotation: 0,
                                color: textColor
                            },
                            min: dateRange.start,
                            max: dateRange.end,
                            pan: {
                                enabled: true,
                                mode: 'x',
                                rangeMin: {
                                    x: dateRange.start.getTime()
                                }
                            }
                        },
                        y: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Amount ($)',
                                color: textColor
                            },
                            grid: {
                                color: gridColor
                            },
                            ticks: {
                                color: textColor,
                                callback: function(value) {
                                    return new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: 'USD',
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0
                                    }).format(value);
                                }
                            }
                        }
                    }
                }
            });

            // Add resize observer
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    if (this.chart) {
                        this.chart.resize();
                    }
                }
            });

            const chartContainer = document.getElementById('chartView');
            if (chartContainer) {
                resizeObserver.observe(chartContainer);
            }
        },
    
        // Process item data with actual dates
        processItemData: function(item) {
            if (!item.data || !item.data.length) return [];
        
            const sortedData = [...item.data].sort((a, b) => 
                new Date(a.date) - new Date(b.date)
            );
        
            let runningTotal = 0;
            const processedData = sortedData.map(transaction => {
                const amount = Number(transaction.amount);
                
                if (item.type === 'credit') {
                    runningTotal += (amount * -1);
                } else if (item.type === 'asset') {
                    runningTotal = amount;
                } else {
                    runningTotal += amount;
                }
        
                // Convert date to Unix timestamp in milliseconds
                const timestamp = new Date(transaction.date).getTime();
        
                return {
                    x: timestamp,
                    y: runningTotal,
                    date: transaction.date, // Keep original date for reference
                    amount: amount         // Keep original amount for reference
                };
            });
        
            // Ensure data is sorted by timestamp
            processedData.sort((a, b) => a.x - b.x);
        
            return processedData;
        },

        calculateVisibleRange: function() {
            if (!this.chart) {
                console.warn("No chart available");
                return { min: 0, max: 0 };
            }
        
            const chart = this.chart;
            const xScale = chart.scales.x;

            if (!xScale || typeof xScale.min === 'undefined' || typeof xScale.max === 'undefined') {
                console.warn("X scale not properly initialized", xScale);
                return { min: 0, max: 0 };
            }
            
            const visibleMin = xScale.min;
            const visibleMax = xScale.max;
        
            let minY = Infinity;
            let maxY = -Infinity;
            let pointsFound = 0;
        
            // Check each dataset
            chart.data.datasets.forEach(dataset => {
                // Skip hidden datasets and special datasets
                if (dataset.hidden || 
                    dataset.label === '_hidden_milestone_line' || 
                    dataset.label === '_hidden_current_date' ||
                    dataset.label === 'Current Date' ||
                    dataset.label === 'Milestones') return;
        
                // Look at each data point
                dataset.data.forEach(point => {
                    // Check if point is within visible x range
                    if (point.x >= visibleMin && point.x <= visibleMax) {
                        if (point.y < minY) minY = point.y;
                        if (point.y > maxY) maxY = point.y;
                        pointsFound++;
                    }
                });
            });

            if (minY === Infinity || maxY === -Infinity) {
                console.warn("No valid data points found in range");
                minY = 0;
                maxY = 100;
            }
        
            // Ensure bottom of Y scale does not move above 0
            if (minY > 0) {
                minY = 0;
            }

            // Add padding (10%)
            const padding = (maxY - minY) * 0.1;
            const range = {
                min: minY - padding,
                max: maxY + padding
            };

            // Store the range
            this.currentRange = range;
        
            return range;
        },

        updateMarkers: function() {
            if (!this.chart || !this.currentRange) return;
        
            const datasets = this.chart.data.datasets;
            
            // Calculate offset (1.75% below max) to avoid cutoff
            const offset = (this.currentRange.max - this.currentRange.min) * 0.0175;
            const markerY = this.currentRange.max - offset;
            
            // Update current date marker
            const currentDateDataset = datasets.find(d => d.label === 'Current Date');
            if (currentDateDataset && currentDateDataset.data[0]) {
                currentDateDataset.data[0].y = markerY;
            }
        
            // Update current date line
            const currentDateLine = datasets.find(d => d.label === '_hidden_current_date');
            if (currentDateLine && currentDateLine.data.length === 2) {
                currentDateLine.data[0].y = this.currentRange.min;
                currentDateLine.data[1].y = this.currentRange.max;  // Keep line extending to full height
            }
        
            // Update milestone markers
            const milestonesDataset = datasets.find(d => d.label === 'Milestones');
            if (milestonesDataset) {
                milestonesDataset.data.forEach(point => {
                    point.y = markerY;
                });
            }
        
            // Update milestone lines
            datasets.forEach(dataset => {
                if (dataset.label === '_hidden_milestone_line') {
                    if (dataset.data.length === 2) {
                        dataset.data[0].y = this.currentRange.min;
                        dataset.data[1].y = this.currentRange.max;  // Keep line extending to full height
                    }
                }
            });
        },
    
        // Update chart with new data
        updateChart: function() {
            const visibleItems = financialItemsManager.items.filter(item => item.isVisible);

            const isDarkMode = $('html').attr('data-theme') === 'dark';
            const dateColor = isDarkMode ? 'white' : 'black';
            
            // Update date range
            const dateRange = this.getDateRange();
            
            // Update x-axis limits
            if (this.chart.options.scales.x) {
                this.chart.options.scales.x.min = dateRange.start;
                this.chart.options.scales.x.max = dateRange.end;
            }
            
            // Process and create datasets
            const datasets = visibleItems.map(item => {
                const processedData = this.processItemData(item);
                
                return {
                    label: item.name,
                    data: processedData,
                    borderColor: item.color,
                    backgroundColor: item.color + '20',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5
                };
            }); 

            // Add goal dataset
            const goalPoints = this.getGoalDataset();
            if (goalPoints.length > 0) {
                datasets.push({
                    label: 'Goals',
                    data: goalPoints,
                    itemIds: goalPoints.map(point => point.itemId),
                    pointRadius: 12,     // Make stars bigger than regular points
                    pointHoverRadius: 15,
                    backgroundColor: '#FFD700', // Gold color
                    borderColor: '#FFD700',
                    borderWidth: 2,
                    showLine: false,     // Don't connect points with lines
                    parsing: {
                        xAxisKey: 'x',
                        yAxisKey: 'y'
                    },
                    // Don't apply decimation to goals
                    normalized: true,
                    spanGaps: true
                });
            }

            // Add milestone dataset
            if (window.milestoneManager && milestoneManager.milestones.length > 0) {
                if (this.chart && this.chart.scales && this.chart.scales.y) {
                    // Collect all milestone data
                    const milestoneData = milestoneManager.milestones.map(milestone => ({
                        x: new Date(milestone.date).getTime(),
                        y: this.calculateMilestoneY(milestone.date),
                        milestoneId: milestone.id,
                        description: milestone.description
                    }));

                    // Push milestone dataset
                    datasets.push({
                        label: 'Milestones',
                        data: milestoneData,
                        backgroundColor: '#FF6B6B',
                        borderColor: '#FF6B6B',
                        rotation: 180,
                        pointRadius: 10,
                        pointHoverRadius: 12,
                        showLine: false,
                        // Don't apply decimation to milestones
                        normalized: true,
                        spanGaps: true
                    });

                    // Add vertical lines for milestones
                    milestoneManager.milestones.forEach(milestone => {
                        const milestoneDate = new Date(milestone.date).getTime();
                        datasets.push({
                            label: '_hidden_milestone_line',
                            data: [
                                {
                                    x: milestoneDate,
                                    y: this.milestoneLowValue
                                },
                                {
                                    x: milestoneDate,
                                    y: this.calculateMilestoneY(milestone.date)
                                }
                            ],
                            borderColor: 'rgba(255, 107, 107, 0.5)',
                            borderWidth: 1,
                            borderDash: [5, 5],
                            pointRadius: 0,
                            fill: false,
                            showLine: true
                        });
                    });
                }
            }

            // Add current date
            datasets.push({
                label: 'Current Date',
                data: [
                    {
                        x: moment().toDate(),
                        y: this.chart.scales.y.max || 0
                    }
                ],
                backgroundColor: dateColor,
                borderColor: dateColor,
                pointStyle: 'triangle',
                rotation: 180,
                pointRadius: 10,
                pointHoverRadius: 12,
                showLine: false,
            });

            // Add vertical line for current date
            datasets.push({
                label: '_hidden_current_date',
                data: [
                    {
                        x: moment(),
                        y: this.chart.scales.y.min || 0
                    },
                    {
                        x: moment(),
                        y: this.chart.scales.y.max || 0
                    }
                ],
                borderColor: dateColor,
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
                showLine: true
            });
            
            this.chart.data.datasets = datasets;

            this.chart.update('none');
            this.updateLegend();
            this.resetZoom();
        },

        updateLegend: function() {
            const $legendContainer = $('#chartLegendContainer');
            $legendContainer.empty();

            const isDarkMode = $('html').attr('data-theme') === 'dark';
            const dateColor = isDarkMode ? 'white' : 'black';
        
            if (!this.chart || !this.chart.data || !this.chart.data.datasets) return;
        
            this.chart.data.datasets.forEach((dataset, index) => {
                // Skip hidden datasets
                if (dataset.label.startsWith('_hidden')) return;
        
                let html = '';
                if (dataset.label === 'Goals') {
                    // Create dropdown for goals
                    html = `
                        <div class="chart-legend-item dropdown">
                            <div class="dropdown-toggle" data-bs-toggle="dropdown">
                                <i class="fas fa-trophy" style="color: ${dataset.borderColor}; font-size: 14px;"></i>
                                <span class="chart-legend-label">${dataset.label}</span>
                            </div>
                            <ul class="dropdown-menu">
                                ${window.goalManager.goals.map(goal => `
                                    <li><a class="dropdown-item" href="#" data-goal-id="${goal.id}">${goal.goalName}</a></li>
                                `).join('')}
                            </ul>
                        </div>
                    `;
                } else if (dataset.label === 'Milestones') {
                    // Create dropdown for milestones
                    html = `
                        <div class="chart-legend-item dropdown">
                            <div class="dropdown-toggle" data-bs-toggle="dropdown">
                                <i class="fas fa-diamond" style="color: ${dataset.borderColor}; font-size: 18px; transform: rotate(180deg);"></i>
                                <span class="chart-legend-label">${dataset.label}</span>
                            </div>
                            <ul class="dropdown-menu">
                                ${window.milestoneManager.milestones.map(milestone => `
                                    <li><a class="dropdown-item" href="#" data-milestone-id="${milestone.id}">${milestone.description}</a></li>
                                `).join('')}
                            </ul>
                        </div>
                    `;
                } else if (dataset.label === 'Current Date') {
                    html = `
                        <div class="chart-legend-item">
                            <i class="fas fa-caret-up me-2" style="color: ${dateColor}; font-size: 28px; transform: rotate(180deg);"></i>
                            <span class="chart-legend-label">${dataset.label}</span>
                        </div>
                    `;
                } else {
                    html = `
                        <div class="chart-legend-item">
                            <span class="chart-legend-color" style="background-color: ${dataset.backgroundColor}; border-color: ${dataset.borderColor}"></span>
                            <span class="chart-legend-label">${dataset.label}</span>
                        </div>
                    `;
                }
        
                const $legendItem = $(html);
        
                // Add click handlers
                if (dataset.label === 'Goals') {
                    $legendItem.find('.dropdown-item').on('click', (evt) => {
                        evt.preventDefault();
                        const goalId = $(evt.currentTarget).data('goal-id');
                        const goal = window.goalManager.goals.find(g => String(g.id) === String(goalId));
                        if (goal) {
                            // Ensure goal point is in view before showing overlay
                            this.ensurePointInView(
                                new Date(goal.targetDate).getTime(),
                                goal.targetAmount
                            );
                            this.showGoalOverlay(goalId, evt);
                        }
                    });
                } else if (dataset.label === 'Milestones') {
                    $legendItem.find('.dropdown-item').on('click', (evt) => {
                        evt.preventDefault();
                        const milestoneId = $(evt.currentTarget).data('milestone-id');
                        const milestone = window.milestoneManager.milestones.find(m => String(m.id) === String(milestoneId));
                        if (milestone) {
                            // Ensure milestone point is in view before showing details
                            this.ensurePointInView(
                                new Date(milestone.date).getTime(),
                                this.calculateMilestoneY(milestone.date)
                            );
                            window.milestoneManager.showMilestoneDetails(milestone, evt);
                        }
                    });
                } else if (dataset.label === 'Current Date') {
                    $legendItem.on('click', () => {
                        this.resetZoom();
                    });
                } else {
                    $legendItem.on('click', (evt) => {
                        const item = financialItemsManager.items.find(i => i.name === dataset.label);
                        if (item) {
                            this.showFinancialItemOverlay(item.id, evt);
                        }
                    });
                }
        
                $legendContainer.append($legendItem);
            });
        },

        calculateMilestoneY: function(date) {
            if (!this.chart || !this.chart.scales || !this.chart.scales.y) {
                return 0;
            }
        
            // Wait for other datasets to be processed
            let maxValue = this.chart.scales.y.max || 0;
            let minValue = this.chart.scales.y.min || 0;
        
            // If scales are available but no data points, check datasets
            if (maxValue === 0 && this.chart.data.datasets) {
                this.chart.data.datasets.forEach(dataset => {
                    if (dataset.label !== 'Milestones' && dataset.label !== '_hidden_milestone_line') {
                        dataset.data.forEach(point => {
                            if (point && typeof point.y === 'number') {
                                maxValue = Math.max(maxValue, point.y);
                                minValue = Math.min(minValue, point.y);
                            }
                        });
                    }
                });
            }
        
            // Store minValue for the vertical line
            this.milestoneLowValue = minValue;
        
            return maxValue;
        },

        // Calculate date range based on all financial items
        getDateRange: function() {
            let earliestDate = null;
            let latestDate = null;
            let hasData = false;
            
            financialItemsManager.items.forEach(item => {
                if (item.data && item.data.length > 0) {
                    hasData = true;
                    // Find earliest date
                    const itemEarliestDate = new Date(Math.min(...item.data.map(d => new Date(d.date))));
                    if (!earliestDate || itemEarliestDate < earliestDate) {
                        earliestDate = itemEarliestDate;
                    }
                    
                    // Find latest date
                    const itemLatestDate = new Date(Math.max(...item.data.map(d => new Date(d.date))));
                    if (!latestDate || itemLatestDate > latestDate) {
                        latestDate = itemLatestDate;
                    }
                }
            });
            
            // If no data found, set a reasonable default range
            if (!hasData) {
                console.warn('No data found in getDateRange, using defaults');
                earliestDate = new Date();
                earliestDate.setFullYear(earliestDate.getFullYear() - 1); // One year ago
                latestDate = new Date();
                latestDate.setFullYear(latestDate.getFullYear() + 1);    // One year from now
            }
            
            // Add padding to the range (1 month before and after)
            earliestDate.setMonth(earliestDate.getMonth() - 1);
            latestDate.setMonth(latestDate.getMonth() + 1);
            
            return {
                start: earliestDate,
                end: latestDate
            };
        },

        // Handle light/dark theme management
        updateChartTheme: function() {
            const isDarkMode = $('html').attr('data-theme') === 'dark';
            
            const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
            const textColor = isDarkMode ? '#f8f9fa' : '#666';
            const buttonColor = isDarkMode ? '#f8f9fa' : '#666';
            const dateColor = isDarkMode ? 'white' : 'black';

            // Update chart options
            if (this.chart) {
                this.chart.options.plugins.legend.labels.color = textColor;
                this.chart.options.scales.x.title.color = textColor;
                this.chart.options.scales.x.grid.color = gridColor;
                this.chart.options.scales.x.ticks.color = textColor;
                this.chart.options.scales.y.title.color = textColor;
                this.chart.options.scales.y.grid.color = gridColor;
                this.chart.options.scales.y.ticks.color = textColor;
                // Update zoom button colors
                $('.zoom-button').css('color', buttonColor);
                // Update current date marker and line color
                const dateMarker = this.chart.data.datasets.find(d => d.label === 'Current Date');
                dateMarker.backgroundColor = dateColor;
                dateMarker.borderColor = dateColor;
                const dateLine = this.chart.data.datasets.find(d => d.label === '_hidden_current_date');
                dateLine.borderColor = dateColor;
                // Update chart
                this.updateChart();
            } else {
                console.log('Chart not found');  // Debug log
            }
        },

        // Zoom handlers
        handleZoom: function(direction) {
            if (!this.chart) return;
            
            const chart = this.chart;
        
            try {
                const scale = chart.scales.x;
                const range = scale.max - scale.min; // These are already timestamps
                const center = (scale.max + scale.min) / 2;
                
                if (direction === 'in') {
                    const newRange = range * 0.8; // Zoom in by 20%
                    chart.zoomScale('x', {
                        min: center - (newRange / 2),
                        max: center + (newRange / 2)
                    });
                } else {
                    const newRange = range * 1.2; // Zoom out by 20%
                    // Calculate new boundaries
                    let newMin = center - (newRange / 2);
                    let newMax = center + (newRange / 2);
                    
                    // Ensure we don't zoom out beyond the absolute earliest date
                    newMin = Math.max(newMin, this.getDateRange().start.getTime());
                    
                    chart.zoomScale('x', {
                        min: newMin,
                        max: newMax
                    });
                }
                
                chart.update('none');
                
            } catch (error) {
                console.error('Zoom operation error:', error);
            }
        },

        resetZoom: function() {
            if (!this.chart) {
                console.log("no chart found in resetZoom");
                return;
            }
            
            const dateRange = this.getDateRange();
            
            // Reset x-axis to full date range
            this.chart.options.scales.x.min = dateRange.start;
            this.chart.options.scales.x.max = dateRange.end;
            
            // Calculate and set y-axis range for full dataset
            const range = this.calculateVisibleRange();
            this.chart.scales.y.options.min = range.min;
            this.chart.scales.y.options.max = range.max;
            
            // Update markers
            this.updateMarkers();
            
            this.chart.update('none');
        },

        // Show financial item on legend click
        showFinancialItemOverlay: function(itemId, evt) {
            const item = financialItemsManager.items.find(i => String(i.id) === String(itemId));
            if (!item) return;
        
            // Create financial item card HTML using the item's HTML template
            const itemCard = financialItemsManager.createItemHtml(item);
            
            // Insert into overlay
            $('#overlayFinancialItemContent').html(itemCard);
            
            // Position the overlay content near the clicked point
            const $overlayContent = $('.financial-item-overlay-content');
            const $canvas = $('#financialChart');
            const canvasRect = $canvas[0].getBoundingClientRect();
            const clickX = evt.clientX - canvasRect.left;
            const clickY = evt.clientY - canvasRect.top;
            
            // Show overlay to calculate its dimensions
            $('.financial-item-overlay').addClass('active');
            
            // Calculate the best position
            const contentWidth = $overlayContent.outerWidth();
            const contentHeight = $overlayContent.outerHeight();
            const windowWidth = $(window).width();
            const windowHeight = $(window).height();
            
            // Initial position near the clicked point
            let left = clickX + canvasRect.left;
            let top = clickY + canvasRect.top;
            
            // Adjust position to keep overlay within viewport
            if (left + contentWidth > windowWidth - 50) {
                left = Math.max(50, windowWidth - contentWidth - 50);
            }
            if (left < 50) {
                left = 50;
            }
            if (top + contentHeight > windowHeight - 50) {
                top = Math.max(50, windowHeight - contentHeight - 50);
            }
            if (top < 50) {
                top = 50;
            }
            
            // Apply the position
            $overlayContent.css({
                left: left + 'px',
                top: top + 'px'
            });
            
            // Re-bind event handlers for the financial item card
            this.rebindFinancialItemCardHandlers(itemId);
            
            // Disable chart interactions
            this.chart.options.events = [];
            this.chart.update('none');
        },
        
        hideFinancialItemOverlay: function() {          
            // Hide overlay with animation
            $('.financial-item-overlay').removeClass('active');
            
            // Clear content after animation
            setTimeout(() => {
                $('#overlayFinancialItemContent').empty();
            }, 300);
            
            // Re-enable chart interactions
            this.chart.options.events = ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'];
            this.chart.update('none');
        },
        
        rebindFinancialItemCardHandlers: function(itemId) {
            // Rebind all the event handlers from financialItemsManager
            const $itemCard = $(`#overlayFinancialItemContent .financial-item[data-item-id="${itemId}"]`);
            
            // Toggle visibility handler
            $itemCard.find('.toggle-input').on('change', (e) => {
                financialItemsManager.toggleItemVisibility(itemId, e.target.checked);
                this.updateChart();
            });
        
            // Delete handler
            $itemCard.find('.delete-item-btn').on('click', (e) => {
                e.preventDefault();
                if (financialItemsManager.deleteItem(itemId)) {
                    this.hideFinancialItemOverlay();
                    this.updateChart();
                }
            });
        
            // Edit handler
            $itemCard.find('.edit-item-btn').on('click', (e) => {
                e.preventDefault();
                this.hideFinancialItemOverlay();
                financialItemsManager.editItem(itemId);
            });
        
            // Update data handler
            $itemCard.find('.update-data-btn').on('click', () => {
                this.hideFinancialItemOverlay();
                financialItemsManager.showUpdateDataModal(itemId);
            });
        },

        // Open update data modal when user clicks a data point
        openUpdateModalAtDate: function(itemId, targetDate) {
            // First, show the modal using the existing method
            financialItemsManager.showUpdateDataModal(itemId);

            // After modal is shown, calculate which page contains our target date
            const item = financialItemsManager.items.find(i => String(i.id) === String(itemId));
            if (!item || !item.data) return;

            // Sort entries by date
            const sortedEntries = [...item.data].sort((a, b) => 
                new Date(a.date) - new Date(b.date)
            );

            // Find the index of the entry closest to our target date
            const targetIndex = sortedEntries.findIndex(entry => 
                new Date(entry.date) >= new Date(targetDate)
            );

            if (targetIndex === -1) return;

            // Calculate which page this entry should be on
            const entriesPerPage = financialItemsManager.getEntriesPerPage();
            const targetPage = Math.floor(targetIndex / entriesPerPage) + 1;

            // Set the page and display entries
            financialItemsManager.currentPage = targetPage;
            financialItemsManager.displayEntries();

            // Highlight the relevant row briefly
            setTimeout(() => {
                const $targetRow = $('#existingEntriesBody tr').filter((_, row) => {
                    const rowDate = $(row).find('td:first').text();
                    return new Date(rowDate) >= new Date(targetDate);
                }).first();

                if ($targetRow.length) {
                    $targetRow.addClass('highlight-row');
                    setTimeout(() => $targetRow.removeClass('highlight-row'), 2000);
                }
            }, 100);
        },

        getGoalDataset: function() {
            const goals = this.getFinancialGoals();
            
            // Create data points for goals
            const goalPoints = goals.reduce((acc, goal) => {
                if (goal.targetDate && (goal.targetAmount !== null && goal.targetAmount !== undefined)) {
                    acc.push({
                        x: new Date(goal.targetDate),
                        y: goal.targetAmount,
                        goalId: goal.id,
                        goalType: 'target'  // useful for click handling later
                    });
                }
                return acc;
            }, []);
    
            return goalPoints;
        },
    
        getFinancialGoals: function() {
            const goals = JSON.parse(localStorage.getItem('financialGoals') || '[]');
            return goals.filter(goal => {
                const isValid = goal.targetDate && 
                    (goal.targetAmount !== null && goal.targetAmount !== undefined);
                return isValid;
            });
        },

        // Add method to get financial item by id
        getFinancialItemById: function(id) {
            const items = JSON.parse(localStorage.getItem('financialItems') || '[]');
            return items.find(item => item.id === id);
        },

        showGoalOverlay: function(goalId, evt) {
            const goal = window.goalManager.goals.find(g => String(g.id) === String(goalId));
            if (!goal) return;
        
            // Create goal card HTML
            const goalCard = window.goalManager.createGoalCard(goal);
            
            // Insert into overlay
            $('#overlayGoalContent').html(goalCard);
            
            
            // Position the overlay content near the clicked point
            const $overlayContent = $('.goal-overlay-content');
            const $canvas = $('#financialChart');
            const canvasRect = $canvas[0].getBoundingClientRect();
            const clickX = evt.clientX - canvasRect.left;
            const clickY = evt.clientY - canvasRect.top;
            

            // Show overlay to calculate its dimensions
            $('.goal-overlay').addClass('active');
            
            
            // Calculate the best position
            const contentWidth = $overlayContent.outerWidth();
            const contentHeight = $overlayContent.outerHeight();
            const windowWidth = $(window).width();
            const windowHeight = $(window).height();
            
            // Initial position near the clicked point
            let left = clickX + canvasRect.left;
            let top = clickY + canvasRect.top;
            
            // Adjust position to keep overlay within viewport
            // Check right edge
            if (left + contentWidth > windowWidth - 50) {
                left = Math.max(50, windowWidth - contentWidth - 50);
            }
            // Check left edge
            if (left < 50) {
                left = 50;
            }
            // Check bottom edge
            if (top + contentHeight > windowHeight - 50) {
                top = Math.max(50, windowHeight - contentHeight - 50);
            }
            // Check top edge
            if (top < 50) {
                top = 50;
            }
            
            // Apply the position
            $overlayContent.css({
                left: left + 'px',
                top: top + 'px'
            });
            
            
            // Re-bind any necessary event handlers for the goal card
            this.rebindGoalCardHandlers(goalId);
            
            // Disable chart interactions
            this.chart.options.events = []; // Disable all chart events
            this.chart.update('none');
        },
        
        hideGoalOverlay: function() {
            // Hide overlay with animation
            $('.goal-overlay').removeClass('active');
            
            // Clear content after animation
            setTimeout(() => {
                $('#overlayGoalContent').empty();
            }, 300); // Match the animation duration from CSS
            
            // Re-enable chart interactions
            this.chart.options.events = ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'];
            this.chart.update('none');
        },
        
        // Add this method to handle re-binding event handlers for the goal card in the overlay
        rebindGoalCardHandlers: function(goalId) {
            // Re-bind edit handler
            $(`#overlayGoalContent .edit-goal[data-goal-id="${goalId}"]`).on('click', (e) => {
                e.preventDefault();
                this.hideGoalOverlay();
                window.goalManager.editGoal(goalId);
            });
        
            // Re-bind delete handler
            $(`#overlayGoalContent .delete-goal[data-goal-id="${goalId}"]`).on('click', (e) => {
                e.preventDefault();
                if (window.goalManager.deleteGoal(goalId)) {
                    this.hideGoalOverlay();
                }
            });
        },

        ensurePointInView: function(timestamp, value) {
            if (!this.chart || !this.chart.scales) return;
        
            const xScale = this.chart.scales.x;
            const yScale = this.chart.scales.y;
            const currentXMin = xScale.min;
            const currentXMax = xScale.max;
            const currentYMin = yScale.min;
            const currentYMax = yScale.max;
        
            let needsUpdate = false;
            let newXMin = currentXMin;
            let newXMax = currentXMax;
            let newYMin = currentYMin;
            let newYMax = currentYMax;
        
            // Check if point is outside current x-axis view
            if (timestamp < currentXMin || timestamp > currentXMax) {
                const padding = (currentXMax - currentXMin) * 0.1; // 10% padding
                if (timestamp < currentXMin) {
                    newXMin = timestamp - padding;
                    newXMax = currentXMax;
                } else {
                    newXMin = currentXMin;
                    newXMax = timestamp + padding;
                }
                needsUpdate = true;
            }
        
            // Check if point is outside current y-axis view
            if (value < currentYMin || value > currentYMax) {
                const padding = (currentYMax - currentYMin) * 0.1; // 10% padding
                if (value < currentYMin) {
                    newYMin = value - padding;
                    newYMax = currentYMax;
                } else {
                    newYMin = currentYMin;
                    newYMax = value + padding;
                }
                needsUpdate = true;
            }
        
            if (needsUpdate) {
                this.chart.zoomScale('x', {
                    min: newXMin,
                    max: newXMax
                });
                this.chart.zoomScale('y', {
                    min: newYMin,
                    max: newYMax
                });
                this.chart.update('none');
            }
        },

        reset: function() {
            // Reset zoom level
            if (this.chart) {
                this.chart.resetZoom();
            }
            
            // Reset view
            $('#viewChart').prop('checked', true);
            $('#chartView').addClass('active');
            $('#summaryView').removeClass('active');
            $('#goalsView').removeClass('active');
            
            // Clear any active highlights or overlays
            $('.financial-item-overlay, .goal-overlay').removeClass('active');
            
            // Update chart with empty/reset data
            this.updateChart();
        }
    };
/* CHART MANAGER CONSTRUCTOR ENDS */


/* METRICS MANAGER CONSTRUCTOR */
    const metricsManager = {
        metricNames: {
            'networth': 'Net Worth',
            'debt': 'Total Debt',
            'assets': 'Total Assets',
            'savings': 'Total Savings',
            'investments': 'Total Investments'
        },

        previousValues: {},
        currentValues: {},

        init: function() {
            // Remove all existing bindings for this manager before reinitializing
            $(document).off('.metricsManager');
            $('body').off('.metricsManager');

            this.bindEvents();
            this.loadSavedState();
            this.updateMetrics();
        },

        bindEvents: function() {
            // Initialize sortable metric cards
            $("#metricCards").sortable({
                items: ".metric-card",
                handle: ".card",
                placeholder: "col-md-4 mb-4 metric-card",
                tolerance: "pointer",
                update: function(event, ui) {
                    metricsManager.saveCardState();
                }
            });

            // Handle hiding of metric cards
            $(document).on('click.metricsManager', '.hide-metric', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const card = $(this).closest('.metric-card');
                const metricType = card.data('metric');
                
                // Add metric back to dropdown
                metricsManager.addToDropdown(metricType);
                
                // Remove card with animation
                card.fadeOut(300, function() {
                    $(this).remove();
                    metricsManager.saveCardState();
                });
            });

            // Handle adding new metric cards
            $(document).on('click.metricsManager', '#metricDropdown .dropdown-item', function(e) {
                e.preventDefault();
                const metricType = $(this).data('metric');
                window.metricsManager.addMetricCard(metricType);
                $(this).parent().remove(); // Remove option from dropdown
                metricsManager.saveCardState();
            });

            // Update metrics when financial items change
            $(document).on('financialItemsUpdated.metricsManager', () => {
                metricsManager.updateMetrics();
            });

            // Update time period display when period changes
            $('input[name="timeperiod"]').on('change.metricsManager', () => {
                this.updateMetrics();
            });
        },

        calculateCurrentMetrics: function() {
            const items = financialItemsManager.items;
            let metrics = {
                networth: 0,
                debt: 0,
                assets: 0,
                savings: 0,
                investments: 0
            };

            items.forEach(item => {
                switch(item.type) {
                    case 'account':
                        metrics.savings += parseFloat(item.currentValue) || 0;
                        metrics.assets += parseFloat(item.currentValue) || 0;
                        break;
                    case 'credit':
                        metrics.debt += parseFloat(item.currentBalance) || 0;
                        break;
                    case 'investment':
                        metrics.investments += parseFloat(item.currentValue) || 0;
                        metrics.assets += parseFloat(item.currentValue) || 0;
                        break;
                    case 'loan':
                        metrics.debt += parseFloat(item.currentBalance) || 0;
                        break;
                    case 'asset':
                        metrics.assets += parseFloat(item.currentValue) || 0;
                        break;
                }
            });

            metrics.networth = parseFloat(metrics.assets - metrics.debt) || 0;

            return metrics;
        },

        calculatePreviousMetrics: function() {
            const items = financialItemsManager.items;
            let metrics = {
                networth: 0,
                debt: 0,
                assets: 0,
                savings: 0,
                investments: 0
            };

            /*
            // Determine comparison date based on period
            const now = moment();
            let compareDate;
            switch(period) {
                case 'yearly':
                    compareDate = now.clone().subtract(1, 'year');
                    break;
                case 'quarterly':
                    compareDate = now.clone().subtract(3, 'months');
                    break;
                default: // monthly
                    compareDate = now.clone().subtract(1, 'month');
            }

            items.forEach(item => {
                // Find the last transaction before the compare date
                const pastTransactions = item.data
                    .filter(t => moment(t.date).isBefore(compareDate))
                    .sort((a, b) => moment(b.date).diff(moment(a.date)));

                if (pastTransactions.length > 0) {
                    let value = 0;
                    // Calculate running total up to compare date
                    item.data
                        .filter(t => moment(t.date).isSameOrBefore(compareDate))
                        .forEach(t => {
                            value += parseFloat(t.amount) || 0;
                        });

                    switch(item.type) {
                        case 'account':
                            metrics.savings += value;
                            metrics.assets += value;
                            break;
                        case 'credit':
                            metrics.debt += value;
                            break;
                        case 'investment':
                            metrics.investments += value;
                            metrics.assets += value;
                            break;
                        case 'loan':
                            metrics.debt += value;
                            break;
                        case 'asset':
                            metrics.assets += value;
                            break;
                    }
    
                    metrics.networth = metrics.assets + metrics.debt || 0;

                }
            }); */

            const previousMonth = moment().subtract(1, 'month').format('YYYY-MM');

            items.forEach(item => {
                switch(item.type) {
                    case 'account':
                        metrics.savings += parseFloat(item.metrics.monthly[previousMonth].averageValue) || 0;
                        metrics.assets += parseFloat(item.metrics.monthly[previousMonth].averageValue) || 0;
                        break;
                    case 'credit':
                        metrics.debt += parseFloat(item.metrics.monthly[previousMonth].averageBalance) || 0;
                        break;
                    case 'investment':
                        metrics.investments += parseFloat(item.metrics.monthly[previousMonth].averageValue) || 0;
                        metrics.assets += parseFloat(item.metrics.monthly[previousMonth].averageValue) || 0;
                        break;
                    case 'loan':
                        metrics.debt += parseFloat(item.metrics.monthly[previousMonth].averageBalance) || 0;
                        break;
                    case 'asset':
                        metrics.assets += parseFloat(item.metrics.monthly[previousMonth].averageValue) || 0;
                        break;
                }
            });

            metrics.networth = parseFloat(metrics.assets - metrics.debt) || 0; //.toFixed(2) if issues with decimal places

            return metrics;
        },

        // Function to add new metric card
        addMetricCard: function(metricType) {
            const metricNames = {
                'networth': 'Net Worth',
                'debt': 'Total Debt',
                'assets': 'Total Assets',
                'savings': 'Total Savings',
                'investments': 'Total Investments'
            };

            const newCard = `
                <div class="col-md-4 mb-4 metric-card" data-metric="${metricType}">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between">
                                <h6 class="card-subtitle mb-2 text-muted">${metricNames[metricType]}</h6>
                                <button class="btn btn-sm btn-link text-muted hide-metric" title="Hide metric">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            <h3 class="card-title metric-value">$0.00</h3>
                            <p class="card-text metric-change">
                                <i class="fas fa-arrow-up me-1"></i>
                                <span class="change-value">+0%</span>
                                <span class="change-period">from last month</span>
                            </p>
                        </div>
                    </div>
                </div>
            `;
            $('#metricCards').append(newCard);

            // Trigger update event
            $(document).trigger('financialItemsUpdated');
        },

        updateMetrics: function() {
            const currentMetrics = this.calculateCurrentMetrics();
            const previousMetrics = this.calculatePreviousMetrics();

            // Update each metric card
            $('.metric-card').each((_, card) => {
                const $card = $(card);
                const metricType = $card.data('metric');
                const currentValue = currentMetrics[metricType];
                const previousValue = previousMetrics[metricType];

                // Update value
                $card.find('.metric-value').text(formatCurrency(currentValue));

                // Calculate and update change
                if (previousValue !== 0) {
                    const percentChange = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
                    const $change = $card.find('.metric-change')
                    $change.html(`<i class="fas fa-arrow-up me-1"></i>
                                <span class="change-value">+0%</span>
                                <span class="change-period">from last month</span>`);
                    const $icon = $change.find('i');
                    const $value = $change.find('.change-value');
                    
                    // Update icon
                    $icon.removeClass('fa-arrow-up fa-arrow-down')
                        .addClass(percentChange >= 0 ? 'fa-arrow-up' : 'fa-arrow-down');
                    
                    // Reverse color for debt
                    if (metricType === 'debt') {
                        $change.removeClass('text-success text-danger')
                        .addClass(percentChange >= 0 ? 'text-danger' : 'text-success');
                    } else {
                        $change.removeClass('text-success text-danger')
                            .addClass(percentChange >= 0 ? 'text-success' : 'text-danger');
                    }
                    
                    // Update values
                    // const trimmedPeriod = period.slice(0, -2);
                    $value.text(`${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%`);
                    $card.find('.change-period').text(`from previous month`);
                } else {
                    $card.find('.metric-change').html('<span class="text-muted">No previous data</span>');
                }
            });
        },

        // Function to add metric card back to dropdown
        addToDropdown: function(metricType) {
            const metricNames = {
                'networth': 'Net Worth',
                'debt': 'Total Debt',
                'assets': 'Total Assets',
                'savings': 'Total Savings',
                'investments': 'Total Investments'
                // Add more metrics as needed
            };

            const dropdownItem = `
                <li>
                    <a class="dropdown-item" href="#" data-metric="${metricType}">
                        ${metricNames[metricType]}
                    </a>
                </li>
            `;
            $('#metricDropdown').append(dropdownItem);
        },

        // Function to track metric card order & visibility
        saveCardState: function() {
            const visibleMetrics = [];
            $('.metric-card').each(function() {
                visibleMetrics.push($(this).data('metric'));
            });
            localStorage.setItem('visibleMetrics', JSON.stringify(visibleMetrics));
        },

        // Function to load saved state
        loadSavedState: function() {
            const defaultMetrics = ['savings', 'debt', 'assets', 'investments', 'networth'];
            const visibleMetrics = JSON.parse(localStorage.getItem('visibleMetrics')) || defaultMetrics;
            
            // Clear existing cards
            $('#metricCards').empty();

            // Add saved metrics (or defaults)
            visibleMetrics.forEach(metric => {
                this.addMetricCard(metric);
            });

            // Update dropdown to only show hidden metrics
            $('#metricDropdown').empty();
            Object.keys(this.metricNames).forEach(metric => {
                if (!visibleMetrics.includes(metric)) {
                    this.addToDropdown(metric);
                }
            });

            // Update metrics after loading cards
            this.updateMetrics();
        },

        reset: function() {
            // Clear data
            this.visibleMetrics = new Set();
            
            // Clear metric cards
            $('#metricCards').empty();
            
            // Enable all options in the dropdown
            $('#metricDropdown .dropdown-item').removeClass('disabled');
        }
    };
/* METRICS MANAGER CONSTRUCTOR ENDS */


/* GOAL MANAGER CONSTRUCTOR */
    const goalManager = {
        goals: [],
    
        init: function() {
            // Remove all existing bindings for this manager before reinitializing
            $(document).off('.goalManager');
            $('body').off('.goalManager');

            this.goals = JSON.parse(localStorage.getItem('financialGoals')) || [];

            // Initialize sortable goal cards
            $("#goalCards").sortable({
                items: ".goal-card",
                handle: ".card",
                placeholder: "col-md-4 mb-4 goal-card",
                tolerance: "pointer",
                update: () => this.saveGoals()
            });

            this.bindEvents();
            this.renderGoals();
        },
        
        bindEvents: function() {
            // Goal type selection handling
            $('#goalType').on('change.goalManager', (e) => {
                const goalType = $(e.target).val();
                if (goalType) {
                    this.handleGoalTypeSelection(goalType);
                }
            });

            // Handle goal saving
            $('#saveGoalBtn').off().on('click.goalManager', () => {    
                this.saveNewGoal();
            });

            // Handle goal editing
            $('#goalCards').on('click.goalManager', '.edit-goal', (e) => {
                e.preventDefault();
                const goalId = String($(e.currentTarget).data('goal-id'));
                this.editGoal(goalId);
            });

            // Handle edit goal saving
            $('#saveEditGoalBtn').off().on('click.goalManager', () => {
                this.saveEditGoal();
            });

            // Reset form when edit modal is closed
            $('#editGoalModal').off().on('hidden.bs.modal.goalManager', () => {
                $('#editGoalForm')[0].reset();
                $('#editGoalForm').children().hide();
                $('#editGoalModal .linked-items-container').empty();
                $('#editGoalForm').modal('hide');

                    // Get the modal instance
                    const modalInstance = bootstrap.Modal.getInstance(this);

                    // Force cleanup
                    if (modalInstance) {
                        modalInstance.dispose();

                        // Remove modal-specific classes and styles
                        $(this).removeClass('show');
                        $('.modal-backdrop').remove();
                        
                        // Reset body styles
                        $('body').removeClass('modal-open')
                                .css({
                                    'overflow': '',
                                    'padding-right': ''
                                })
                                .removeAttr('data-bs-padding-right');
                    }
            });
            
            // Handle goal deletion
            $('#goalCards').on('click.goalManager', '.delete-goal', (e) => {
                e.preventDefault();
                const goalId = String($(e.currentTarget).data('goal-id'));
                this.deleteGoal(goalId);
            });

            // Reset form when modal is closed
            $('#addGoalModal').on('hidden.bs.modal.goalManager', () => {
                this.resetForm();
            });

            // Add handler for modal show to populate financial items
            $('#addGoalModal').on('show.bs.modal.goalManager', () => {
                this.populateLinkedItems();
            });

            // Add handler for goal type changes
            $('#goalType').on('change.goalManager', () => {
                this.updateLinkedItemsBasedOnType();
            });
        },

        handleGoalTypeSelection: function(goalType) {
            // First, hide all goal-type-specific sections
            $('#budgetingOptions, #budgetingDetails').hide();
            $('#savingOptions, #savingDetails').hide();
            $('#investingOptions, #investingDetails').hide();
            $('#retirementOptions, #retirementDetails').hide();
            $('#debtOptions, #debtDetails').hide();
            
            // Hide any conditional fields that might be visible
            $('#otherSavingDescription').hide();
            
            switch(goalType) {
                case 'budgeting':
                    $('#budgetingOptions').show();
                    this.populateLinkedItems('budgeting');
                    break;
                    
                case 'saving':
                    $('#savingOptions').show();
                    this.populateLinkedItems('saving');
                    break;
                    
                case 'investing':
                    $('#investingOptions').show();
                    this.populateLinkedItems('investing');
                    break;
                    
                case 'retirement':
                    $('#retirementOptions').show();
                    this.populateLinkedItems('retirement');
                    break;

                case 'debt':
                    $('#debtOptions').show();
                    this.populateLinkedItems('debt');
                    break;
            }
        
            // Handle the subtype selections for each goal type
            this.setupSubTypeHandlers(goalType);
        },
        
        setupSubTypeHandlers: function(goalType) {
            // Remove any existing subtype handlers
            $('#budgetGoalType, #savingGoalType, #investingGoalType, #retirementGoalType, #debtGoalType').off('change');
            
            switch(goalType) {
                case 'budgeting':
                    $('#budgetGoalType').on('change', (e) => {
                        if ($(e.target).val()) {
                            $('#budgetingDetails').show();
                        }
                    });
                    break;
                    
                case 'saving':
                    $('#savingGoalType').on('change', (e) => {
                        const savingType = $(e.target).val();
                        if (savingType) {
                            $('#savingDetails').show();
                            $('#otherSavingDescription').toggle(savingType === 'other');
                        }
                    });
                    break;
                    
                case 'investing':
                    $('#investingGoalType').on('change', (e) => {
                        if ($(e.target).val()) {
                            $('#investingDetails').show();
                        }
                    });
                    break;
                    
                case 'retirement':
                    $('#retirementGoalType').on('change', (e) => {
                        if ($(e.target).val()) {
                            $('#retirementDetails').show();
                        }
                    });
                    break;

                case 'debt':
                    $('#debtGoalType').on('change', (e) => {
                        if ($(e.target).val()) {
                            $('#debtDetails').show();
                        }
                    });
                    break;
            }
        },
        
        validateGoalFields: function(goalType) {
            switch(goalType) {
                case 'budgeting':
                    return {
                        isValid: $('#budgetGoalType').val() && 
                                $('#budgetTargetAmount').is(':visible') && 
                                $('#budgetTargetAmount').val() && 
                                $('input[name="linkedItems"]:checked').length > 0,
                        message: 'Please fill in all required fields for the budget goal'
                    };
                    
                case 'saving':
                    const savingType = $('#savingGoalType').val();
                    let hasValidDescription = true;
                    
                    if (savingType === 'other' && $('#otherSavingDescription').is(':visible')) {
                        hasValidDescription = $('#otherGoalDescription').val().trim() !== '';
                    }
                    return {
                        isValid: savingType && 
                                hasValidDescription && 
                                (!$('#savingTargetAmount').is(':visible') || $('#savingTargetAmount').val()) && 
                                (!$('#savingTargetDate').is(':visible') || $('#savingTargetDate').val()) && 
                                $('input[name="linkedItems"]:checked').length > 0,
                        message: 'Please fill in all required fields for the saving goal'
                    };
                    
                case 'investing':
                    return {
                        isValid: $('#investingGoalType').val() && 
                                (!$('#investingTargetAmount').is(':visible') || 
                                $('#investingTargetAmount').val()) && 
                                (!$('#investingTargetDate').is(':visible') || 
                                $('#investingTargetDate').val()) && 
                                $('input[name="linkedItems"]:checked').length > 0,
                        message: 'Please fill in all required fields for the investment goal'
                    };
                    
                case 'retirement':
                    return {
                        isValid: $('#retirementGoalType').val() && 
                                (!$('#retirementTargetAmount').is(':visible') || 
                                $('#retirementTargetAmount').val()) && 
                                (!$('#investingTargetDate').is(':visible') || 
                                $('#investingTargetDate').val()) && 
                                $('input[name="linkedItems"]:checked').length > 0,
                        message: 'Please fill in all required fields for the retirement goal'
                    };

                case 'debt':
                    return {
                        isValid: $('#debtGoalType').val() && 
                                (!$('#debtTargetAmount').is(':visible') || 
                                $('#debtTargetAmount').val()) && 
                                (!$('#investingTargetDate').is(':visible') || 
                                $('#investingTargetDate').val()) && 
                                $('input[name="linkedItems"]:checked').length > 0,
                        message: 'Please fill in all required fields for the debt goal'
                    };
                    
                default:
                    return {
                        isValid: false,
                        message: 'Invalid goal type'
                    };
            }
        },

        populateLinkedItems: function(goalType) {
            const $container = $('.linked-items-container');
            $container.empty();
            
            /*
            // Get the correct container based on goal type
            const typeContainer = goalType ? $(`#${goalType}Details`) : null;
            if (typeContainer) {
                typeContainer.show(); // Ensure the type-specific container is visible
            } */

            const validItems = this.getValidAccountsForGoalType(goalType);
            
            if (validItems.length === 0) {
                $container.append(`
                    <div class="text-muted">
                        ${this.getNoAccountsMessageForGoalType(goalType)}
                    </div>
                `);
                return;
            }
        
            validItems.forEach(item => {
                $container.append(`
                    <div class="form-check mb-2">
                        <input class="form-check-input" type="checkbox" 
                            name="linkedItems" value="${item.id}" 
                            id="item-${item.id}">
                        <label class="form-check-label" for="item-${item.id}">
                            ${item.name} (${financialItemsManager.getTypeDisplay(item.type)})
                        </label>
                    </div>
                `);
            });

            /*
            // Ensure all parent containers are visible
            $container.parents().each(function() {
                if ($(this).css('display') === 'none') {
                    $(this).show();
                }
            }); */
        },

        getValidAccountsForGoalType: function(goalType) {
            switch(goalType) {
                case 'budgeting':
                    return financialItemsManager.items.filter(item => 
                        ['account', 'credit'].includes(item.type)
                    );
                case 'saving':
                    return financialItemsManager.items.filter(item => 
                        ['account', 'investment'].includes(item.type)
                    );
                case 'investing':
                    return financialItemsManager.items.filter(item => 
                        ['investment'].includes(item.type)
                    );
                case 'retirement':
                    return financialItemsManager.items.filter(item => 
                        ['account', 'investment', 'asset'].includes(item.type)
                    );
                case 'debt':
                    return financialItemsManager.items.filter(item => 
                        ['credit', 'loan'].includes(item.type)
                    );
                default:
                    return [];
            }
        },
        
        getNoAccountsMessageForGoalType: function(goalType) {
            switch(goalType) {
                case 'budgeting':
                    return 'No eligible accounts or credit cards available';
                case 'saving':
                    return 'No eligible bank accounts or investment accounts available';
                case 'investing':
                    return 'No eligible investment accounts available';
                case 'retirement':
                    return 'No eligible bank accounts, investment accounts, or assets available';
                case 'debt':
                    return 'No eligible credit cards or loans available';
                default:
                    return 'No eligible accounts available';
            }
        },

        updateLinkedItemsBasedOnType: function() {
            const goalType = $('#goalType').val();
            const $select = $('#goalLinkedItems');
            $select.find('option').prop('disabled', false);
    
            // Filter relevant financial items based on goal type
            switch(goalType) {
                case 'budgeting':
                    // Enable only expense-related items
                    $select.find('option').each(function() {
                        const itemType = $(this).text().match(/\((.*?)\)/)[1];
                        if (itemType !== 'credit') {
                            $(this).prop('disabled', true);
                        }
                    });
                    break;
                case 'investing':
                    // Enable only investment accounts
                    $select.find('option').each(function() {
                        const itemType = $(this).text().match(/\((.*?)\)/)[1];
                        if (itemType !== 'investment') {
                            $(this).prop('disabled', true);
                        }
                    });
                    break;
                case 'retirement':
                    // Enable only account, investment, and asset items
                    $select.find('option').each(function() {
                        const itemType = $(this).text().match(/\((.*?)\)/)[1];
                        if (!['account', 'investment', 'asset'].includes(itemType)) {
                            $(this).prop('disabled', true);
                        }
                    });
                    break;
                case 'debt':
                    // Enable only credit and loan items
                    $select.find('option').each(function() {
                        const itemType = $(this).text().match(/\((.*?)\)/)[1];
                        if (!['credit', 'loan'].includes(itemType)) {
                            $(this).prop('disabled', true);
                        }
                    });
                    break;
            }
        },
        
        saveNewGoal: function() {
            try {
                throw new Error();
            } catch (e) {
                const stack = e.stack.split('\n');
            }

            const goalType = $('#goalType').val();
            const validation = this.validateGoalFields(goalType);
            if (!validation.isValid) {
                $('#addGoalModal').modal('hide');
                this.resetForm();
                this.showToast(validation.message, 'error');
                return;
            }
        
            const baseGoalData = {
                id: Date.now().toString(),
                createdAt: new Date().toISOString(),
                type: goalType,
                linkedItems: $('input[name="linkedItems"]:checked').map(function() {
                    return $(this).val();
                }).get()
            };
        
            try {
                const goalData = {
                    ...baseGoalData,
                    ...this.processGoalTypeData(goalType)
                };
        
                this.goals.push(goalData);
                this.saveGoals();
                this.renderGoals();
                chartManager.updateChart();
                const lastGoal = this.goals[this.goals.length - 1];
                chartManager.ensurePointInView(
                    new Date(lastGoal.targetDate).getTime(),
                    lastGoal.targetAmount
                );
                
                $('#addGoalModal').modal('hide');
                this.resetForm();
                this.showToast('Goal added successfully', 'success');
        
            } catch (error) {
                $('#addGoalModal').modal('hide');
                this.resetForm();
                this.showToast(error.message, 'error');
            }
        },

        processGoalTypeData: function(goalType) {
            switch(goalType) {
                case 'budgeting':
                    return {
                        subType: $('#budgetGoalType').val(),
                        goalName: $('#budgetGoalType option:selected').text(),
                        targetAmount: parseFloat($('#budgetTargetAmount').val()),
                        lastMonthExpenses: this.calculateLastMonthExpenses(this.getSelectedItems()),
                        currentMonthExpenses: this.calculateCurrentMonthExpenses(this.getSelectedItems())
                    };
        
                case 'saving':
                    const savingType = $('#savingGoalType').val();
                    let subType = savingType;
                    let goalName = $('#savingGoalType option:selected').text();
                    
                    if (savingType === 'other') {
                        const description = $('#otherGoalDescription').val().trim();
                        subType = `other_${description}`;
                        goalName = description;
                    }
        
                    return {
                        subType: subType,
                        goalName: goalName,
                        targetAmount: parseFloat($('#savingTargetAmount').val()),
                        targetDate: $('#savingTargetDate').val(),
                        currentAmount: this.calculateCurrentAmount('saving', this.getSelectedItems())
                    };
        
                case 'investing':
                    return {
                        subType: $('#investingGoalType').val(),
                        goalName: $('#investingGoalType option:selected').text(),
                        targetAmount: parseFloat($('#investingTargetAmount').val()),
                        targetDate: $('#investingTargetDate').val(),
                        currentAmount: this.calculateCurrentAmount('investing', this.getSelectedItems())
                    };
        
                case 'retirement':
                    return {
                        subType: $('#retirementGoalType').val(),
                        goalName: $('#retirementGoalType option:selected').text(),
                        targetAmount: parseFloat($('#retirementTargetAmount').val()),
                        targetDate: $('#retirementTargetDate').val(),
                        currentAmount: this.calculateCurrentAmount('retirement', this.getSelectedItems())
                    };

                case 'debt':
                    const currentAmount = this.calculateCurrentAmount('debt', this.getSelectedItems());
                    return {
                        subType: $('#debtGoalType').val(),
                        goalName: $('#debtGoalType option:selected').text(),
                        targetAmount: parseFloat($('#debtTargetAmount').val()),
                        targetDate: $('#debtTargetDate').val(),
                        currentAmount: currentAmount,
                        intitalAmount: currentAmount
                    };
        
                default:
                    throw new Error('Invalid goal type');
            }
        },

        getSelectedItems: function() {
            return $('input[name="linkedItems"]:checked').map(function() {
                return $(this).val();
            }).get();
        },

        calculateCurrentAmount: function(goalType, linkedItems) {
            switch(goalType) {
                case 'saving':
                    return linkedItems.reduce((total, itemId) => {
                        const item = financialItemsManager.items.find(i => String(i.id) === String(itemId));
                        if (!item) {
                            return total;
                        } else if (item.type === 'account') {
                            return total + (item.currentValue || 0);
                        } else if (item.type === 'investment') {
                            return total + (item.currentValue || 0);
                        }
                    }, 0);
        
                case 'investing':
                    return linkedItems.reduce((total, itemId) => {
                        const item = financialItemsManager.items.find(i => String(i.id) === String(itemId));
                        if (!item) {
                            return total;
                        } else if (item.type === 'investment') {
                            return total + (item.currentValue || 0);
                        }
                    }, 0);
        
                case 'retirement':
                    return linkedItems.reduce((total, itemId) => {
                        const item = financialItemsManager.items.find(i => String(i.id) === String(itemId));
                        if (!item) {
                            return total;
                        } else if (item.type === 'account') {
                            return total + (item.currentValue || 0);
                        } else if (item.type === 'investment') {
                            return total + (item.currentValue || 0);
                        } else if (item.type === 'asset') {
                            return total + (item.metrics?.summary?.currentEquity || 0);
                        }
                    }, 0);

                case 'debt':
                    return linkedItems.reduce((total, itemId) => {
                        const item = financialItemsManager.items.find(i => String(i.id) === String(itemId));
                        if (!item) {
                            return total;
                        } else if (item.type === 'credit') {
                            return total + (item.currentBalance || 0);
                        } else if (item.type === 'loan') {
                            return total + (item.currentBalance || 0);
                        }
                    }, 0);
        
                default:
                    return 0;
            }
        },

        editGoal: function(goalId) {
            const goal = this.goals.find(g => String(g.id) === String(goalId));
            if (!goal) return;
            
            switch(goal.type) {
                case 'budgeting':
                    $('#editBudgetingGoal').show();
                    $('#editBudgetingGoalId').val(goal.id);
                    $('#editBudgetingGoalName').val(goal.goalName);
                    $('#editBudgetingTargetAmount').val(goal.targetAmount);
                    break;
        
                case 'saving':
                    $('#editSavingGoal').show();
                    $('#editSavingGoalId').val(goal.id);
                    $('#editSavingGoalName').val(goal.goalName);
                    $('#editSavingTargetAmount').val(goal.targetAmount);
                    $('#editSavingTargetDate').val(goal.targetDate);
                    break;
        
                case 'investing':
                    $('#editInvestingGoal').show();
                    $('#editInvestingGoalId').val(goal.id);
                    $('#editInvestingGoalName').val(goal.goalName);
                    $('#editInvestingTargetAmount').val(goal.targetAmount);
                    $('#editInvestingTargetDate').val(goal.targetDate);
                    break;
        
                case 'retirement':
                    $('#editRetirementGoal').show();
                    $('#editRetirementGoalId').val(goal.id);
                    $('#editRetirementGoalName').val(goal.goalName);
                    $('#editRetirementTargetAmount').val(goal.targetAmount);
                    $('#editRetirementTargetDate').val(goal.targetDate);
                    break;

                case 'debt':
                    $('#editDebtGoal').show();
                    $('#editDebtGoalId').val(goal.id);
                    $('#editDebtGoalName').val(goal.goalName);
                    $('#editDebtTargetAmount').val(goal.targetAmount);
                    $('#editDebtTargetDate').val(goal.targetDate);
                    break;
            }
            
            // Populate linked items
            const $container = $('#editGoalModal .linked-items-container');
            $container.empty();
            
            // Get valid items based on goal type
            const validItems = this.getValidAccountsForGoalType(goal.type);
            
            validItems.forEach(item => {
                const isChecked = goal.linkedItems.includes(String(item.id));
                $container.append(`
                    <div class="form-check mb-2">
                        <input class="form-check-input" type="checkbox" 
                            name="editLinkedItems" value="${item.id}" 
                            id="edit-item-${item.id}" ${isChecked ? 'checked' : ''}>
                        <label class="form-check-label" for="edit-item-${item.id}">
                            ${item.name} (${item.type})
                        </label>
                    </div>
                `);
            });
            
            // Show the modal
            const editModal = new bootstrap.Modal('#editGoalModal');
            editModal.show();
        },

        saveEditGoal: function() {
            // Get the visible goal form (only one should be visible)
            const visibleForm = $('#editGoalForm > div:visible');
            if (!visibleForm.length) {
                console.error('No visible goal form found');
                return;
            }
        
            // Get the goal ID from the visible form
            const goalId = visibleForm.find('input[type="hidden"]').val();
            const goal = this.goals.find(g => String(g.id) === String(goalId));
            if (!goal) {
                console.error('Goal not found:', goalId);
                return;
            }
        
            // Get unique linked items
            const linkedItems = [...new Set($('#editGoalModal .linked-items-container input:checked').map(function() {
                return $(this).val();
            }).get())];
        
            if (linkedItems.length === 0) {
                this.showToast('Please select at least one account to track', 'error');
                return;
            }
        
            // Create a copy of the existing goal to preserve type-specific fields
            let updatedGoal = { ...goal };
        
            // Update common fields
            updatedGoal.linkedItems = linkedItems;
            updatedGoal.lastUpdated = new Date().toISOString();
        
            // Update type-specific fields
            try {
                switch (goal.type) {
                    case 'budgeting':
                        updatedGoal.goalName = $('#editBudgetingGoalName').val().trim();
                        updatedGoal.targetAmount = parseFloat($('#editBudgetingTargetAmount').val());
                        // Preserve currentMonthExpenses and lastMonthExpenses
                        break;
                    case 'saving':
                        updatedGoal.goalName = $('#editSavingGoalName').val().trim();
                        updatedGoal.targetAmount = parseFloat($('#editSavingTargetAmount').val());
                        updatedGoal.targetDate = $('#editSavingTargetDate').val();
                        // Preserve currentAmount if it exists
                        break;
                    case 'investing':
                        updatedGoal.goalName = $('#editInvestingGoalName').val().trim();
                        updatedGoal.targetAmount = parseFloat($('#editInvestingTargetAmount').val());
                        updatedGoal.targetDate = $('#editInvestingTargetDate').val();
                        // Preserve currentAmount if it exists
                        break;
                    case 'retirement':
                        updatedGoal.goalName = $('#editRetirementGoalName').val().trim();
                        updatedGoal.targetAmount = parseFloat($('#editRetirementTargetAmount').val());
                        updatedGoal.targetDate = $('#editRetirementTargetDate').val();
                        // Preserve currentAmount if it exists
                        break;
                    case 'debt':
                        updatedGoal.goalName = $('#editDebtGoalName').val().trim();
                        updatedGoal.targetAmount = parseFloat($('#editDebtTargetAmount').val());
                        updatedGoal.targetDate = $('#editDebtTargetDate').val();
                        // Preserve currentAmount and initialAmount if they exist
                        break;
                }
        
                // Replace the old goal
                const goalIndex = this.goals.findIndex(g => String(g.id) === String(goalId));
                this.goals[goalIndex] = updatedGoal;
        
                // Update progress and save changes
                this.updateGoalProgress(goalId);
                this.renderGoals();
                chartManager.updateChart();

                const thisGoal = this.goals[goalIndex];
                chartManager.ensurePointInView(
                    new Date(thisGoal.targetDate).getTime(),
                    thisGoal.targetAmount
                );
        
                // Close modal and show success message
                const modal = bootstrap.Modal.getInstance($('#editGoalModal'));
                if (modal) {
                    modal.hide();
                }
                
                this.showToast('Goal updated successfully', 'success');
        
            } catch (error) {
                console.error('Error saving goal:', error);
                this.showToast('Error saving goal: ' + error.message, 'error');
            }
        },

        showToast: function(message, type = 'info') {
            if (window.financialItemsManager) {
                window.financialItemsManager.showToast(message, type);
            }
        },

        updateGoalProgress: function(goalId) {
            const goal = this.goals.find(g => String(g.id) === String(goalId));
            if (!goal) return;
        
            switch(goal.type) {
                case 'budgeting':
                    goal.currentMonthExpenses = this.calculateCurrentMonthExpenses(goal.linkedItems);
                    break;
                case 'saving':
                    goal.currentAmount = this.calculateCurrentAmount('saving', goal.linkedItems);
                    break;
                case 'investing':
                    goal.currentAmount = this.calculateCurrentAmount('investing', goal.linkedItems);
                    break;
                case 'retirement':
                    goal.currentAmount = this.calculateCurrentAmount('retirement', goal.linkedItems);
                    break;
                case 'debt':
                    goal.currentAmount = this.calculateCurrentAmount('debt', goal.linkedItems);
                    break;
            }
        
            this.saveGoals();
        },
        
        renderGoals: function() {
            const goalsHtml = this.goals.map(goal => this.createGoalCard(goal)).join('');
            $('#goalCards').html(goalsHtml || '<p class="text-muted text-center">No goals set yet. Click "Add Goal" to get started!</p>');
        },

        createGoalCard: function(goal) {
            // Common card wrapper start
            const cardHtml = `
                <div class="col-md-4 mb-4 goal-card" data-goal-id="${goal.id}">
                    <div class="card">
                        <div class="card-body">
                            ${this.createGoalCardHeader(goal)}
                            ${this.createGoalCardContent(goal)}
                        </div>
                    </div>
                </div>
            `;
            return cardHtml;
        },
        
        createGoalCardHeader: function(goal) {
            return `
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h5 class="card-title mb-1">${this.getGoalTypeDisplay(goal.type)}: ${this.getGoalName(goal)}</h5>
                        ${this.createGoalCardSubtitle(goal)}
                    </div>
                    <div class="goal-controls">
                        <button class="btn btn-sm btn-link edit-goal p-0 me-2" 
                                data-goal-id="${goal.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-link text-danger delete-goal p-0" 
                                data-goal-id="${goal.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        },
        
        createGoalCardSubtitle: function(goal) {
            switch(goal.type) {
                case 'budgeting':
                    return `
                        <p class="card-subtitle text-muted small mb-2">
                            Target: ${formatCurrency(goal.targetAmount)}
                        </p>
                    `;
                    
                case 'saving':
                    return `
                        <p class="card-subtitle text-muted small mb-2">
                            Target: ${formatCurrency(goal.targetAmount)} by ${formatDate(goal.targetDate)}
                        </p>
                    `;
                    
                case 'investing':
                    return `
                        <p class="card-subtitle text-muted small mb-2">
                            Target: ${formatCurrency(goal.targetAmount)} by ${formatDate(goal.targetDate)}
                        </p>
                    `;
                    
                case 'retirement':
                    return `
                        <p class="card-subtitle text-muted small mb-2">
                            Target: ${formatCurrency(goal.targetAmount)} by ${formatDate(goal.targetDate)}
                        </p>
                    `;
                
                case 'debt':
                    return `
                        <p class="card-subtitle text-muted small mb-2">
                            Target: ${formatCurrency(goal.targetAmount)} by ${formatDate(goal.targetDate)}
                        </p>
                    `;
                default:
                    return '';
            }
        },
        
        createGoalCardContent: function(goal) {
            const linkedItemNames = goal.linkedItems
                .map(id => financialItemsManager.items.find(item => 
                    String(item.id) === String(id))?.name || 'Unknown')
                .join(', ');
        
            return `
                <p class="card-text small mb-2">Tracking: ${linkedItemNames}</p>
                ${this.createGoalProgress(goal)}
            `;
        },
        
        createGoalProgress: function(goal) {
            switch(goal.type) {
                case 'budgeting': {
                    const budgetProgress = (goal.currentMonthExpenses / goal.targetAmount) * 100;
                    const isNearlyOverBudget = budgetProgress > 85;
                    const isOverBudget = budgetProgress > 100;
                    const budgetProgressBarClass = isOverBudget ? 'bg-danger' : (isNearlyOverBudget ? 'bg-warning' : 'bg-success');
                    
                    return `
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <small class="text-muted">Last Month: ${formatCurrency(goal.lastMonthExpenses)}</small>
                            <small class="text-muted">Current: ${formatCurrency(goal.currentMonthExpenses)}</small>
                        </div>
                        <div class="progress goal-progress">
                            <div class="progress-bar ${budgetProgressBarClass}" 
                                 role="progressbar" 
                                 style="width: ${Math.min(budgetProgress, 100)}%" 
                                 aria-valuenow="${budgetProgress}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                            </div>
                        </div>
                    `;
                }

                case 'saving': {
                    const savingProgress = (goal.currentAmount / goal.targetAmount) * 100;
                    const isBelow85 = savingProgress < 85;
                    const isBelow10 = savingProgress < 10;
                    const savingProgressBarClass = isBelow10 ? 'bg-danger' : (isBelow85 ? 'bg-warning' : 'bg-success');
                    const daysToTarget = moment(goal.targetDate).diff(moment(), 'days');
                    
                    return `
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <small class="text-muted">Current: ${formatCurrency(goal.currentAmount)}</small>
                            <small class="text-muted">${daysToTarget} days remaining</small>
                        </div>
                        <div class="progress goal-progress">
                            <div class="progress-bar ${savingProgressBarClass}" 
                                 role="progressbar" 
                                 style="width: ${Math.min(savingProgress, 100)}%" 
                                 aria-valuenow="${savingProgress}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                            </div>
                        </div>
                    `;
                }

                case 'investing': {
                    const investingProgress = (goal.currentAmount / goal.targetAmount) * 100;
                    const isBelow85 = investingProgress < 85;
                    const isBelow10 = investingProgress < 10;
                    const investingProgressBarClass = isBelow10 ? 'bg-danger' : (isBelow85 ? 'bg-warning' : 'bg-success');
                    const daysToTarget = moment(goal.targetDate).diff(moment(), 'days');
                    
                    return `
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <small class="text-muted">Current: ${formatCurrency(goal.currentAmount)}</small>
                            <small class="text-muted">${daysToTarget} days remaining</small>
                        </div>
                        <div class="progress goal-progress">
                            <div class="progress-bar ${investingProgressBarClass}" 
                                 role="progressbar" 
                                 style="width: ${Math.min(investingProgress, 100)}%" 
                                 aria-valuenow="${investingProgress}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                            </div>
                        </div>
                    `;
                }

                case 'retirement': {
                    const retirementProgress = (goal.currentAmount / goal.targetAmount) * 100;
                    const isBelow85 = retirementProgress < 85;
                    const isBelow10 = retirementProgress < 10;
                    const retirementProgressBarClass = isBelow10 ? 'bg-danger' : (isBelow85 ? 'bg-warning' : 'bg-success');
                    const daysToTarget = moment(goal.targetDate).diff(moment(), 'days');
                    
                    return `
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <small class="text-muted">Current: ${formatCurrency(goal.currentAmount)}</small>
                            <small class="text-muted">${daysToTarget} days remaining</small>
                        </div>
                        <div class="progress goal-progress">
                            <div class="progress-bar ${retirementProgressBarClass}" 
                                 role="progressbar" 
                                 style="width: ${Math.min(retirementProgress, 100)}%" 
                                 aria-valuenow="${retirementProgress}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                            </div>
                        </div>
                    `;
                }

                case 'debt': {
                    const debtProgress = ((goal.initialAmount - goal.currentAmount) / (goal.initialAmount - goal.targetAmount)) * 100;
                    const isBelow85 = debtProgress < 85;
                    const isBelow10 = debtProgress < 10;
                    const debtProgressBarClass = isBelow10 ? 'bg-danger' : (isBelow85 ? 'bg-warning' : 'bg-success');
                    const daysToTarget = moment(goal.targetDate).diff(moment(), 'days');
                    
                    return `
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <small class="text-muted">Current: ${formatCurrency(goal.currentAmount)}</small>
                            <small class="text-muted">${daysToTarget} days remaining</small>
                        </div>
                        <div class="progress goal-progress">
                            <div class="progress-bar ${debtProgressBarClass}" 
                                 role="progressbar" 
                                 style="width: ${Math.min(debtProgress, 100)}%" 
                                 aria-valuenow="${debtProgress}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                            </div>
                        </div>
                    `;
                }
        
                default:
                    return '';
            }
        },

        getGoalTypeDisplay: function(type) {
            // If no type is provided, return empty string
            if (!type) return '';

            switch (type) {
                case 'budgeting':
                    return 'Budgeting Goal';
                case 'saving':
                    return 'Saving Goal';
                case 'investing':
                    return 'Investment Goal';
                case 'retirement':
                    return 'Retirement Goal';
                case 'debt':
                    return 'Debt Reduction Goal';
                default:
                    return type;
            }
        },
        
        // Add a separate method for handling goal names
        getGoalName: function(goal) {
            if (goal.type === 'saving' && goal.subType && goal.subType.startsWith('other_')) {
                return goal.subType.replace('other_', '');
            }
            return goal.goalName;
        },
        
        updateGoal: function(goalId) {
            const index = this.goals.findIndex(g => g.id === goalId);
            if (index === -1) return;
            
            this.goals[index] = {
                ...this.goals[index],
                type: $('#goalType').val(),
                title: $('#goalTitle').val().trim(),
                description: $('#goalDescription').val().trim(),
                targetAmount: parseFloat($('#goalAmount').val()),
                targetDate: $('#goalDate').val() || null,
                linkedItems: $('input[name="linkedItems"]:checked').map(function() {
                    return $(this).val();
                }).get(),
            };
            
            this.updateGoalProgress(goalId);
            this.renderGoals();
            chartManager.updateChart();
        },
        
        deleteGoal: async function(goalId) {
            const goal = this.goals.find(g => String(g.id) === String(goalId));
            if (!goal) return;
           
            const confirmed = await showConfirmation(
                'Delete Goal',
                `Are you sure you want to delete this goal?`
            );

            if (confirmed) {
                this.goals = this.goals.filter(g => String(g.id) !== String(goalId));
                this.saveGoals();
                this.renderGoals();
                chartManager.updateChart();
                return true;
            }
        },
        
        saveGoals: function() {
            localStorage.setItem('financialGoals', JSON.stringify(this.goals));
        },

        calculateLastMonthExpenses: function(linkedItems) {
            let total = 0;
            const today = new Date();
            const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
                .toISOString().split('T')[0];
            const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
                .toISOString().split('T')[0];
        
            linkedItems.forEach(itemId => {
                const item = financialItemsManager.items.find(i => String(i.id) === String(itemId));
                if (!item || !item.data) return;
        
                const monthlyExpenses = item.data
                    .filter(trans => {
                        const date = trans.date;
                        const amount = Number(trans.amount);
                        const isExpense = amount < 0;
                        const isInRange = date >= lastMonthStart && date <= lastMonthEnd;
                        
                        return isExpense && isInRange;
                    })
                    .reduce((sum, trans) => sum + Math.abs(Number(trans.amount)), 0);
        
                total += monthlyExpenses;
            });
            return total;
        },
        
        calculateCurrentMonthExpenses: function(linkedItems) {
            let total = 0;
            const today = new Date();
            const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
                .toISOString().split('T')[0];
            const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
                .toISOString().split('T')[0];
        
            linkedItems.forEach(itemId => {
                const item = financialItemsManager.items.find(i => String(i.id) === String(itemId));
                if (!item || !item.data) return;
        
                const monthlyExpenses = item.data
                    .filter(trans => {
                        const date = trans.date;
                        const amount = Number(trans.amount);
                        const isExpense = amount < 0;
                        const isInRange = date >= currentMonthStart && date <= currentMonthEnd;
                        
                        return isExpense && isInRange;
                    })
                    .reduce((sum, trans) => sum + Math.abs(Number(trans.amount)), 0);
        
                total += monthlyExpenses;
            });
            return total;
        },
                
        calculateCurrentSavings: function(linkedItems) {
            let total = 0;
            linkedItems.forEach(itemId => {
                const item = financialItemsManager.items.find(i => String(i.id) === String(itemId));
                if (!item) return;
        
                if (item.type === 'account') {
                    total += item.currentValue || 0;
                } else if (item.type === 'investment') {
                    total += item.currentValue || 0;
                }
            });
            return total;
        },

        resetForm: function() {
            $('#addGoalForm').find(':focus').blur();
            $('#addGoalForm')[0].reset();
            $('#budgetingOptions, #budgetingDetails').hide();
            $('#savingOptions, #savingDetails').hide();
            $('#investingOptions, investingDetails').hide();
            $('#retirementOptions, #retirementDetails').hide();
            $('#debtOptions, #debtDetails').hide();
            $('.linked-items-container').empty();
            $('#goalCards').focus();
        },

        reset: function() {
            // Clear data
            this.goals = [];
            
            // Reset form states
            $('#addGoalForm')[0].reset();
            $('#editGoalForm')[0].reset();
            
            // Reset all goal type specific fields
            ['budgeting', 'saving', 'investing', 'retirement', 'debt'].forEach(type => {
                $(`#${type}Options`).hide();
                $(`#${type}Details`).hide();
            });
            
            // Reset dropdowns and selections
            $('#goalType').val('');
            $('.linked-items-container').empty();
            
            // Close modals
            $('#addGoalModal, #editGoalModal').modal('hide');
            
            // Update UI
            this.renderGoals();
        }
    };
/* GOAL MANAGER CONSTRUCTOR ENDS */


/* MILESTONE MANAGER CONSTRUCTOR */
/* MILESTONE MANAGER CONSTRUCTOR */
const milestoneManager = {
    milestones: [],

    init: function() {
        // Remove all existing bindings for this manager before reinitializing
        $(document).off('.milestoneManager');
        $('body').off('.milestoneManager');

        this.milestones = JSON.parse(localStorage.getItem('financialMilestones')) || [];
        this.bindEvents();
    },

    bindEvents: function() {
        // Update milestone saving with editing support
        $('#saveMilestoneBtn').off().on('click.milestoneManager', () => {
            const date = $('#milestoneDate').val();
            const description = $('#milestoneDescription').val();
            const editingId = $('#saveMilestoneBtn').attr('data-editing-id');
            let thisMilestoneIndex = -1;

            if (!date || !description) {
                financialItemsManager.showToast('Please fill in all fields', 'error');
                return;
            }
            
            if (editingId) {
                // Update existing milestone
                const index = this.milestones.findIndex(m => String(m.id) === String(editingId));
                if (index !== -1) {
                    this.milestones[index] = {
                        ...this.milestones[index],
                        date: date,
                        description: description
                    };
                    financialItemsManager.showToast('Milestone updated successfully', 'success');
                    thisMilestoneIndex = index;
                }
                // Clear editing state
                $('#saveMilestoneBtn').removeAttr('data-editing-id');
            } else {
                // Add new milestone
                this.addMilestone({
                    id: Date.now().toString(),
                    date: date,
                    description: description
                });
            }
    
            this.saveMilestones();
            chartManager.updateChart();

            if (thisMilestoneIndex === -1) {
                const thisMilestone = this.milestones[this.milestones.length - 1];
                chartManager.ensurePointInView(
                    new Date(thisMilestone.date).getTime(),
                    chartManager.calculateMilestoneY(thisMilestone.date)
                );
            } else {
                const thisMilestone = this.milestones[thisMilestoneIndex];
                chartManager.ensurePointInView(
                    new Date(thisMilestone.date).getTime(),
                    chartManager.calculateMilestoneY(thisMilestone.date)
                );
            }
        
            // Reset modal title
            $('#addMilestoneModal .modal-title').text('Add Milestone');
            
            // Hide modal and reset form
            const modal = bootstrap.Modal.getInstance('#addMilestoneModal');
            modal.hide();
            $('#addMilestoneForm')[0].reset();
            $('#milestoneDate').val('');
            $('#milestoneDescription').val('');
            $('#addMilestoneModal').find('button:focus').blur();
            $('#financialChart').focus();
        });
    
        // Add handler for modal close to reset edit state
        $('#addMilestoneModal').on('hidden.bs.modal.milestoneManager', () => {
            $('#saveMilestoneBtn').removeAttr('data-editing-id');
            $('#addMilestoneModal .modal-title').text('Add Milestone');
            $('#addMilestoneForm')[0].reset();
        });

        // Handle milestone deletion
        $(document).on('click.milestoneManager', '.delete-milestone', async (e) => {
            const milestoneId = $(e.currentTarget).data('milestone-id');

            const confirmed = await showConfirmation(
                'Delete Milestone',
                'Are you sure you want to delete this milestone?'
            );

            if (confirmed) {
                this.deleteMilestone(milestoneId);
                this.hideMilestoneDetails();
            }
        });

        // Handle milestone editing
        $(document).on('click.milestoneManager', '.edit-milestone', (e) => {
            const milestoneId = $(e.currentTarget).data('milestone-id');
            this.editMilestone(milestoneId);
            this.hideMilestoneDetails();
        });

        // Close milestone details when clicking outside
        $(document).on('click.milestoneManager', '.milestone-overlay', function(e) {
            if ($(e.target).hasClass('milestone-overlay')) {
                milestoneManager.hideMilestoneDetails();
            }
        });

        $(document).on('click.milestoneManager', '.milestone-close', () => {
            this.hideMilestoneDetails();
        });
    },

    addMilestone: function(milestone) {
        // Check if milestone with same date/description already exists
        const exists = this.milestones.some(m => 
            m.date === milestone.date && 
            m.description === milestone.description
        );
        
        if (!exists) {
            this.milestones.push(milestone);
            this.saveMilestones();
            chartManager.updateChart();

            const thisMilestone = this.milestones[this.milestones.length - 1];
            chartManager.ensurePointInView(
                new Date(thisMilestone.date).getTime(),
                chartManager.calculateMilestoneY(thisMilestone.date)
            );

            financialItemsManager.showToast('Milestone added successfully', 'success');
        }
    },

    editMilestone: function(milestoneId) {
        const milestone = this.milestones.find(m => String(m.id) === String(milestoneId));
        if (!milestone) return;
    
        // Reset form and set values
        $('#addMilestoneForm')[0].reset();
        $('#milestoneDate').val(milestone.date);
        $('#milestoneDescription').val(milestone.description);
        
        // Store editing ID on the button
        $('#saveMilestoneBtn').attr('data-editing-id', milestone.id);
        
        // Update modal title to indicate editing
        $('#addMilestoneModal .modal-title').text('Edit Milestone');
        
        // Show the modal
        const addMilestoneModal = new bootstrap.Modal('#addMilestoneModal');
        addMilestoneModal.show();
    },

    deleteMilestone: function(milestoneId) {        
        this.milestones = this.milestones.filter(m => String(m.id) !== String(milestoneId));

        this.saveMilestones();
        chartManager.updateChart();
        financialItemsManager.showToast('Milestone deleted successfully', 'success');
    },

    saveMilestones: function() {
        localStorage.setItem('financialMilestones', JSON.stringify(this.milestones));
    },

    showMilestoneDetails: function(milestone, evt) {
        const html = `
            <div class="milestone-overlay d-flex justify-content-center align-items-center">
                <div class="milestone-details-content">
                    <button class="milestone-close">&times;</button>
                    <h5>Milestone Details</h5>
                    <p class="mb-2">
                        <strong>Date:</strong> ${formatDate(milestone.date)}
                    </p>
                    <p class="mb-3">
                        <strong>Description:</strong> ${milestone.description}
                    </p>
                    <div class="milestone-controls">
                        <button class="btn btn-sm btn-primary edit-milestone" 
                                data-milestone-id="${milestone.id}">
                            Edit
                        </button>
                        <button class="btn btn-sm btn-danger delete-milestone" 
                                data-milestone-id="${milestone.id}">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remove any existing overlay
        $('.milestone-overlay').remove();
        
        // Add new overlay
        $('body').append(html);
        
        // Get the milestone's point position from the chart
        const chart = window.chartManager.chart;
        const milestoneDataset = chart.data.datasets.find(d => d.label === 'Milestones');
        
        if (milestoneDataset) {
            const datasetIndex = chart.data.datasets.indexOf(milestoneDataset);
            const meta = chart.getDatasetMeta(datasetIndex);
            // Find the index of our milestone in the dataset
            const pointIndex = milestoneDataset.data.findIndex(d => d.milestoneId === milestone.id);
            
            if (pointIndex !== -1 && meta.data[pointIndex]) {
                const point = meta.data[pointIndex];
                const canvasRect = chart.canvas.getBoundingClientRect();
                const pointX = point.x + canvasRect.left;
                const pointY = point.y + canvasRect.top;

                // Position the overlay content near the milestone point
                const $overlayContent = $('.milestone-details-content');

                // Show overlay to calculate its dimensions
                $('.milestone-overlay').addClass('active');

                // Calculate the best position
                const contentWidth = $overlayContent.outerWidth();
                const contentHeight = $overlayContent.outerHeight();
                const windowWidth = $(window).width();
                const windowHeight = $(window).height();

                // Initial position near the milestone point
                let left = pointX;
                let top = pointY;

                // Adjust position to keep overlay within viewport
                // Check right edge
                if (left + contentWidth > windowWidth - 50) {
                    left = Math.max(50, windowWidth - contentWidth - 50);
                }
                // Check left edge
                if (left < 50) {
                    left = 50;
                }
                // Check bottom edge
                if (top + contentHeight > windowHeight - 50) {
                    top = Math.max(50, windowHeight - contentHeight - 50);
                }
                // Check top edge
                if (top < 50) {
                    top = 50;
                }

                $overlayContent.css({
                    left: left + 'px',
                    top: top + 'px'
                });
            }
        }

        /*
        const $content = $('.milestone-details-content');
        const contentWidth = $content.outerWidth();
        const contentHeight = $content.outerHeight();
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        

        // Position the details in the center of the screen
        const left = (windowWidth - contentWidth) / 2;
        const top = (windowHeight - contentHeight) / 2;

        // Position the details near the click
        let left = evt.clientX;
        let top = evt.clientY;
        
        // Adjust position to keep within viewport
        if (left + contentWidth > windowWidth - 20) {
            left = windowWidth - contentWidth - 20;
        }
        if (top + contentHeight > windowHeight - 20) {
            top = windowHeight - contentHeight - 20;
        }
        
        $content.css({
            left: left + 'px',
            top: top + 'px'
        });
        */
    
        // Show with animation
        $('.milestone-overlay').fadeIn(200);

        // Disable chart interactions while overlay is shown
        if (window.chartManager && window.chartManager.chart) {
            window.chartManager.chart.options.events = [];
            window.chartManager.chart.update('none');
        }
    },

    hideMilestoneDetails: function() {
        $('.milestone-overlay').fadeOut(200, function() {
            $(this).remove();
        });
    },

    reset: function() {
        // Clear data
        this.milestones = [];
        
        // Reset form
        $('#addMilestoneForm')[0].reset();
        
        // Close modal
        $('#addMilestoneModal').modal('hide');
        
        // Clear any highlighted rows or active overlays
        $('.milestone-overlay').removeClass('active');
    }
};
/* MILESTONE MANAGER CONSTRUCTOR ENDS */


/* TOUR MANAGER CONSTRUCTOR */
const tourManager = {    

    tour: null,
    activeStep: null,
    
    init: function() {
        // Remove all existing bindings for this manager before reinitializing
        $(document).off('.tourManager');
        $('body').off('.tourManager');

        // Check if we should show initial modal
        if (localStorage.getItem('guidedSetupDone') !== 'true' && 
            localStorage.getItem('dontShowGuidedSetup') !== 'true') {
            this.showInitialModal();
        }
        
        // Initialize tour
        this.tour = new Shepherd.Tour({
            useModalOverlay: false,
            defaultStepOptions: {
                classes: 'shepherd-theme-custom',
                scrollTo: false,
                cancelIcon: {
                    enabled: true
                },
                buttons: [
                    {
                        text: 'Exit Tour',
                        action: () => this.handleTourExit(),
                        classes: 'btn btn-outline-danger'
                    },
                    /*
                    {
                        text: 'Back',
                        action: () => this.tour.back(),
                        classes: 'btn btn-outline-primary'
                    }, */
                    {
                        text: 'Next',
                        action: () => this.tour.next(),
                        classes: 'btn btn-primary'
                    }
                ],
                beforeShow: () => {
                    this.activeStep = this.tour.currentStep;
                    this.highlightElement(this.tour.currentStep.options.attachTo?.element);
                    
                    // Ensure chart is properly sized
                    if (window.chartManager && window.chartManager.chart) {
                        window.chartManager.chart.resize();
                    }
                },
                hide: () => {
                    this.handleTourExit();
                    /*
                    this.removeHighlight();
                    
                    // Resize chart after hiding step
                    if (window.chartManager && window.chartManager.chart) {
                        window.chartManager.chart.resize();
                    }
                    */ 
                }
            }
        });
        
        this.setupTourSteps();
        this.bindEvents();
    },

    bindEvents: function() {
        // Handle initial modal interactions
        $('#startTourBtn').on('click.tourManager', () => {
            const dontShowAgain = $('#dontShowAgain').prop('checked');
            if (dontShowAgain) {
                localStorage.setItem('dontShowGuidedSetup', 'true');
            }
            $('#initialGuidedSetupModal').modal('hide');
            this.startTour();
        });

        $('#skipTourBtn').on('click.tourManager', () => {
            const dontShowAgain = $('#dontShowAgain').prop('checked');
            if (dontShowAgain) {
                localStorage.setItem('dontShowGuidedSetup', 'true');
            }
        });

        // Handle guided setup button
        $('#guidedSetup').off('click').on('click.tourManager', async () => {
            const confirmed = await showConfirmation(
                'Start Tour',
                'Starting the tour will overwrite any unsaved data. Do you want to proceed?'
            );

            if (confirmed) {
                this.startTour();
            }
        });
    },

    showInitialModal: function() {
        // Wait for next tick to ensure DOM is ready
        setTimeout(() => {
            const $modalElement = $('#initialGuidedSetupModal');
            if ($modalElement.length) {
                const modal = new bootstrap.Modal($modalElement[0], {
                    backdrop: true,
                    keyboard: true
                });
                modal.show();
                $modalElement.on('hide.bs.modal', function() {
                    $('#guidedSetup').focus();
                    $('#initialGuidedSetupModal').find(':focus').blur();
                });
            }
        }, 0);
    },

    handleTourExit: async function() {
        const confirmed = await showConfirmation(
            'End Tour',
            'Are you sure you want to end the guided setup? You can always restart it using the "Guided Setup" button.'
        );

        if (confirmed) {
            this.tour.complete();
            this.removeHighlight();
            this.clearTourData();
        }
    },

    startTour: function() {
        this.tourData = this.createTourData();

        $('#initialGuidedSetupModal').find(':focus').blur();

        // Ensure Overview tab is active
        $('.nav-link[href="#overview"]').tab('show');
        
        // Ensure Chart view is active
        $('#viewChart').prop('checked', true).trigger('change');
        
        // Give the chart time to adjust layout
        setTimeout(() => {
            if (window.chartManager && window.chartManager.chart) {
                window.chartManager.chart.resize();
            }
            this.tour.start();
        }, 300);
    },

    highlightElement: function(selector) {
        if (!selector) return;
        
        // Remove any existing highlight
        this.removeHighlight();
        
        // Add overlay
        $('body').append('<div class="tour-overlay"></div>');
        
        // Add highlight
        const $element = $(selector);
        const offset = $element.offset();
        const width = $element.outerWidth();
        const height = $element.outerHeight();
        
        $('body').append(`
            <div class="tour-highlight" style="
                top: ${offset.top}px;
                left: ${offset.left}px;
                width: ${width}px;
                height: ${height}px;
            "></div>
        `);
        
        // Add focus class to element
        $element.addClass('tour-focus');
    },

    removeHighlight: function() {
        $('.tour-overlay, .tour-highlight').remove();
        $('.tour-focus').removeClass('tour-focus');
    },

    setupTourSteps: function() {
        const currentTheme = $('html').attr('data-theme');

        // Welcome step
        this.tour.addStep({
            id: 'welcome',
            text: `
                <h4>Welcome to Your Financial Dashboard!</h4>
                <p>Let's take a quick tour to help you get started. We'll show you how to:</p>
                <ul>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-compass text-primary me-2"></i>
                        Navigate the dashboard
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-piggy-bank text-primary me-2"></i>
                        Add and manage your financial items
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-eye text-primary me-2"></i>
                        Use different views and features
                    </li>
                </ul>
                <p>You can exit the tour at any time by clicking the "Exit Tour" button.</p>
            `,
            classes: 'shepherd-welcome',
            buttons: [
                {
                    text: 'Exit Tour',
                    action: () => this.handleTourExit(),
                    classes: 'btn btn-outline-danger'
                },
                {
                    text: 'Get Started',
                    action: () => this.tour.next(),
                    classes: 'btn btn-primary'
                }
            ]
        });

        // Navigation step
        this.tour.addStep({
            id: 'navigation',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    // On mobile, expand the navigation menu
                    if ($(window).width() <= 768) {
                        const navbarCollapse = document.querySelector('#navbarNav');
                        if (navbarCollapse && !navbarCollapse.classList.contains('show')) {
                            $('.navbar-toggler').click();
                        }
                    }
                    setTimeout(resolve, 300); // Give time for animation
                });
            },
            attachTo: {
                element: '.navbar',
                on: 'bottom'
            },
            text: `
                <h4>Navigation</h4>
                <p>The top navigation bar lets you access different sections of your dashboard:</p>
                <ul>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-home text-primary me-2"></i>
                        <strong>Overview:</strong>&nbsp;Your main financial snapshot
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-wallet text-primary me-2"></i>
                        <strong>Budget:</strong>&nbsp;Track your spending
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-piggy-bank text-primary me-2"></i>
                        <strong>Savings:</strong>&nbsp;Monitor your savings goals
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-chart-bar text-primary me-2"></i>
                        <strong>Investments:</strong>&nbsp;Track your investment portfolio
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-umbrella-beach text-primary me-2"></i>
                        <strong>Retirement:</strong>&nbsp;Plan for your future
                    </li>
                </ul>
            `,
            classes: 'shepherd-step',
        });

        // Settings and Theme
        this.tour.addStep({
            id: 'settings',
            attachTo: {
                element: '.quick-actions',
                on: 'bottom'
            },
            text: `
                <h4>Quick Actions</h4>
                <p>This is where you can access important features and settings:</p>
                <ul>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-question-circle text-primary me-2"></i>
                        <strong>Help:</strong>&nbsp;Get assistance and tips
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="${currentTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun'} text-primary me-2"></i>
                        <strong>Theme:</strong>&nbsp;Switch between light and dark mode
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-magic text-primary me-2"></i>
                        <strong>Reset:</strong>&nbsp;Reset the current dashboard
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-upload text-primary me-2"></i>
                        <strong>Load:</strong>&nbsp;Load previously saved progress
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-save text-primary me-2"></i>
                        <strong>Save:</strong>&nbsp;Save your current progress
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-cog text-primary me-2"></i>
                        <strong>Settings:</strong>&nbsp;Customize your dashboard
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-user-circle text-primary me-2"></i>
                        <strong>Profile:</strong>&nbsp;Manage your account
                    </li>
                </ul>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    // Collapse nav on mobile when leaving this step
                    if ($(window).width() <= 768) {
                        const navbarCollapse = document.querySelector('#navbarNav');
                        if (navbarCollapse && navbarCollapse.classList.contains('show')) {
                            $('.navbar-toggler').click();
                        }
                    }
                }
            }
        });

        // Financial Items
        this.tour.addStep({
            id: 'financial-items',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    // On mobile, expand the controls collapse
                    if ($(window).width() <= 768) {
                        const controlsCollapse = document.querySelector('#controlsCollapse');
                        if (controlsCollapse && !controlsCollapse.classList.contains('show')) {
                            $('button[data-bs-target="#controlsCollapse"]').click();
                        }
                    }
                    setTimeout(resolve, 300); // Give time for animation
                });
            },
            attachTo: {
                element: '.sidebar',
                on: 'right'
            },
            text: `
                <h4>Financial Items</h4>
                <p>This is where you manage your financial items:</p>
                <ul>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-plus text-primary me-2"></i>
                        Add bank accounts, credit cards, investments, etc.
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-arrows text-primary me-2"></i>
                        Drag and drop to reorder items
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-toggle-on text-primary me-2"></i>
                        Toggle visibility in the chart
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-upload text-primary me-2"></i>
                        Update account data manually or via CSV
                    </li>
                </ul>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    // Collapse controls on mobile when leaving this step
                    if ($(window).width() <= 768) {
                        const controlsCollapse = document.querySelector('#controlsCollapse');
                        if (controlsCollapse && controlsCollapse.classList.contains('show')) {
                            $('button[data-bs-target="#controlsCollapse"]').click();
                        }
                    }
                }
            }
        });

        // Financial Items - Add Item Button
        this.tour.addStep({
            id: 'financial-items-add-item-button',
            attachTo: {
                element: '#addItemBtn',
                on: 'right'
            },
            text: `
                <h4>Add Financial Item</h4>
                <p>You can use the "Add" button to add new financial items to your list.</p>
                <p>Let's walk through the process of adding a new item.</p>
            `,
            classes: 'shepherd-step',
        });

        // Financial Items - Add Item Menu
        this.tour.addStep({
            id: 'financial-items-add-item-menu',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    $('#addItemBtn').click();
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#addItemModal .modal-content',
                on: 'bottom'
            },
            text: `
                <h4>Add Financial Item</h4>
                <p>This is where you'll enter details for your new financial item.</p>
                <p>For this example, we're going to add a bank account.</p>
            `,
            classes: 'shepherd-step',
        });

        // Financial Items - Add Item Menu (Name)
        this.tour.addStep({
            id: 'financial-items-add-item-menu-name',
            attachTo: {
                element: '#itemName',
                on: 'bottom'
            },
            text: `
                <h4>Add Financial Item</h4>
                <p>First, we'll need to name the item.</p>
                <p>Let's call this "Demo Chequing Account".</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#itemName').val('Demo Chequing Account');
                }
            }
        });

        // Financial Items - Add Item Menu (Type)
        this.tour.addStep({
            id: 'financial-items-add-item-menu-type',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    $('#itemType').click();
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#itemType',
                on: 'bottom'
            },
            text: `
                <h4>Add Financial Item</h4>
                <p>Next we'll select an item type from the dropdown.</p>
                <p>Let's select "Bank Account".</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('ul.dropdown-menu .dropdown-item[data-value="account"]').click();
                }
            }
        });

        // Financial Items - Add Item Menu (Balance)
        this.tour.addStep({
            id: 'financial-items-add-item-menu-balance',
            attachTo: {
                element: '#initialBalance',
                on: 'bottom'
            },
            text: `
                <h4>Add Financial Item</h4>
                <p>Once an item type is selected, you'll be asked to enter details for the item you want to create.</p>
                <p>Since we're adding a bank account, we'll first need to enter the initial balance.</p>
                <p>Let's use $2000 for our initial account balance.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#initialBalance').val('2000');
                }
            }
        });

        // Financial Items - Add Item Menu (Date)
        this.tour.addStep({
            id: 'financial-items-add-item-menu-date',
            attachTo: {
                element: '#accountStartDate',
                on: 'bottom'
            },
            text: `
                <h4>Add Financial Item</h4>
                <p>Next we'll need to enter the date we want to start tracking this account from.</p>
                <p>Let's use ${createOffsetDate(-90)} as our start date.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#accountStartDate').val(createOffsetDate(-90));
                }
            }
        });

        // Financial Items - Add Item Menu (Color)
        this.tour.addStep({
            id: 'financial-items-add-item-menu-color',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#itemColor',
                on: 'bottom'
            },
            text: `
                <h4>Add Financial Item</h4>
                <p>Finally, we need to select a color from the dropdown to represent the new item.</p>
                <p>Let's choose blue to identify this account.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#itemColor').parent().find('.dropdown-item[data-value="#1f77b4"]').click();
                }
            }
        });

        // Financial Items - Add Item Menu (Save Item)
        this.tour.addStep({
            id: 'financial-items-add-item-menu-save',
            attachTo: {
                element: '#saveItemBtn',
                on: 'bottom'
            },
            text: `
                <h4>Add Financial Item</h4>
                <p>Now we're ready to save!</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#saveItemBtn').click();
                }
            }
        });

        // Financial Items - Add Item Menu (View New Item)
        this.tour.addStep({
            id: 'financial-items-add-item-menu-new-item',
            attachTo: {
                element: '#financialItemsList',
                on: 'right'
            },
            text: `
                <h4>Add Financial Item</h4>
                <p>Once you've saved an item, it will appear in your financial items list.</p>
                <p>Each card contains several options for managing the item and viewing additional details.</p>
            `,
            classes: 'shepherd-step'
        });

        // Financial Items Header Controls
        this.tour.addStep({
            id: 'financial-items-header',
            attachTo: {
                element: '.financial-item-header',
                on: 'right'
            },
            text: `
                <h4>Financial Item Controls</h4>
                <p>At the top of each item card, you have options to:</p>
                <ul>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-edit text-primary me-2"></i>
                        Edit the item
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-trash text-primary me-2"></i>
                        Delete the item
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-toggle-on text-primary me-2"></i>
                        Toggle visibility in the chart
                    </li>
                </ul>
                <p>Toggling the visibility and deleting an item are pretty self-explanatory, but let's
                take a quick look at the edit item menu.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('.financial-item button.edit-item-btn').click();
                }
            }
        });

        // Financial Items - Edit Item
        this.tour.addStep({
            id: 'financial-items-edit-item',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300); // Give time for animation
                });
            },
            attachTo: {
                element: '#editItemModal .modal-content',
                on: 'bottom'
            },
            text: `
                <h4>Edit Financial Item</h4>
                <p>Opening the edit item menu allows you to modify the name and color of an existing item.
                When you're done, click "Save Changes".</p>
                <p>Now let's go back to our financial item card to see what other options we have.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#editItemModal .modal-footer').find('button').first().click();
                }
            }
        });        

        // Financial Items - Item Details
        this.tour.addStep({
            id: 'financial-items-item-details',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300); // Give time for animation
                });
            },
            attachTo: {
                element: '.financial-item-details',
                on: 'right'
            },
            text: `
                <h4>Financial Item Details</h4>
                <p>Each item card also contains details such as your current balance.</p>
            `,
            classes: 'shepherd-step'
        });

        // Financial Items - Expand Item Details
        this.tour.addStep({
            id: 'financial-items-expand-item-details',
            attachTo: {
                element: '.toggle-details',
                on: 'right'
            },
            text: `
                <h4>Financial Item Details</h4>
                <p>Clicking "Show Details" allows you to view additional metrics for the item.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('.toggle-details').click();
                }
            }
        });

        // Financial Items - Item Details Expanded
        this.tour.addStep({
            id: 'financial-items-item-details-expanded',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300); // Give time for animation
                });
            },
            attachTo: {
                element: '.collapse-details',
                on: 'right'
            },
            text: `
                <h4>Financial Item Details</h4>
                <p>For bank accounts, expanding the details tab allows you to view the monthly change in your account value.</p>
                <p>Different item types will contain different details. For example, credit cards will display the interest rate,
                credit limit, and credit utilization.</p>
            `,
            classes: 'shepherd-step',
        });

        // Financial Items - Collapse Item Details
        this.tour.addStep({
            id: 'financial-items-collapse-item-details',
            attachTo: {
                element: '.toggle-details',
                on: 'right'
            },
            text: `
                <h4>Financial Item Details</h4>
                <p>You can collapse the details tab by clicking the "Hide Details" button.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('.toggle-details').click();
                }
            }
        });

        // Financial Items - Update Data
        this.tour.addStep({
            id: 'financial-items-update-data',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300); // Give time for animation
                });
            },
            attachTo: {
                element: '.update-data-btn',
                on: 'right'
            },
            text: `
                <h4>Update Financial Item Data</h4>
                <p>Finally, the "Update Data" button allows you to update your financial item data manually or via CSV upload.</p
                <p>Let's walk through the process of adding some data for our bank account.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('.update-data-btn').click();
                }
            }
        });

        // Financial Items - Update Data Tab
        this.tour.addStep({
            id: 'financial-items-update-data-tab',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#updateDataModal .modal-content',
                on: 'bottom'
            },
            text: `
                <h4>Update Financial Item Data</h4>
                <p>This is where you update your account balances and enter your transaction history.
                Within this form you have the option to:</p>
                <ul>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-pencil-alt text-primary me-2"></i>
                        Enter data manually
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-file-csv text-primary me-2"></i>
                        Upload via CSV
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-trash text-primary me-2"></i>
                        Delete existing entries
                    </li>
                </ul>
                <p>We can see that our only existing entry is the $2000 initial balance we set up earlier.
                Let's add some transactions!</p>
            `,
            classes: 'shepherd-step'
        });

        // Financial Items - Manual Entry (Date)
        this.tour.addStep({
            id: 'financial-items-update-data-manual-date',
            attachTo: {
                element: '#transactionDate',
                on: 'bottom'
            },
            text: `
                <h4>Manual Entry</h4>
                <p>To add a transaction manually, we first need to enter a date.</p>
                <p>Let's set this transaction for ${createOffsetDate(-80)}.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#transactionDate').val(createOffsetDate(-80));
                }
            }
        });

        // Financial Items - Manual Entry (Amount)
        this.tour.addStep({
            id: 'financial-items-update-data-manual-amount',
            attachTo: {
                element: '#transactionAmount',
                on: 'bottom'
            },
            text: `
                <h4>Manual Entry</h4>
                <p>Next we'll need to enter a transaction amount. This can be either positive or negative.</p>
                <p>Let's say we made a purchase of $500, so we'll enter "-500".</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#transactionAmount').val('-500');
                }
            }
        });

        // Financial Items - Manual Entry (Description)
        this.tour.addStep({
            id: 'financial-items-update-data-manual-description',
            attachTo: {
                element: '#transactionDescription',
                on: 'bottom'
            },
            text: `
                <h4>Manual Entry</h4>
                <p>Finally, we need to enter a description for our transaction.</p>
                <p>We'll say that this transaction was for groceries.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#transactionDescription').val('Groceries');
                }
            }
        });

        // Financial Items - Manual Entry (Add Entry)
        this.tour.addStep({
            id: 'financial-items-update-data-manual-add',
            attachTo: {
                element: '#manualEntryForm button',
                on: 'bottom'
            },
            text: `
                <h4>Manual Entry</h4>
                <p>Now we're ready to add this entry by clicking the "Add Entry" button.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#manualEntryForm button').click();
                }
            }
        });

        // Financial Items - Manual Entry (View Entry)
        this.tour.addStep({
            id: 'financial-items-update-data-manual-view',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: function() {
                    const newEntry = $('#existingEntriesBody tr').last();
                    newEntry.attr('id', 'demo-row');
                    const selector = `#${newEntry.attr('id')}`;
                    return selector;
                },
                on: 'bottom'
            },
            text: `
                <h4>Manual Entry</h4>
                <p>Now we can see that our new entry has been added to the list of existing entries.</p>
            `,
            classes: 'shepherd-step',
        });

        // Financial Items - Manual Entry (Delete Entry)
        this.tour.addStep({
            id: 'financial-items-update-data-delete',
            attachTo: {
                element: function() {
                    const newEntry = $('.delete-entry').last();
                    newEntry.attr('id', 'test-entry');
                    const selector = `#${newEntry.attr('id')}`;
                    return selector;
                },
                on: 'bottom'
            },
            text: `
                <h4>Removing An Entry</h4>
                <p>You can delete an entry by clicking on the trash icon.
                Let's remove this entry, since we're going to upload data via CSV next.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('.delete-entry').last().click();
                }
            }
        });

        // Financial Items - Manual Entry (Confirm Delete)
        this.tour.addStep({
            id: 'financial-items-update-confirm-delete',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#confirmationModal .modal-content',
                on: 'bottom'
            },
            text: `
                <h4>Confirming Deletion</h4>
                <p>Since deleting an item will remove it permanently, you'll be asked to confirm that you want to delete the item.
                We'll click "Confirm" to continue with removing this entry.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#confirmButton').click();
                }
            }
        });

        // Financial Items - CSV Upload
        this.tour.addStep({
            id: 'financial-items-update-data-csv',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#updateDataModal .modal-content',
                on: 'bottom'
            },
            text: `
                <h4>CSV Upload</h4>
                <p>There - we've removed the entry for our groceries.
                Next, we'll walk through the process of uploaded data via CSV.</p>
            `,
            classes: 'shepherd-step'
        });

        // Financial Items - CSV Upload (Navigation)
        this.tour.addStep({
            id: 'financial-items-update-data-csv-navigation',
            attachTo: {
                element: function() {
                    const newEntry = $('#updateDataModal .nav-link').last();
                    newEntry.attr('id', 'csv-upload-button');
                    const selector = `#${newEntry.attr('id')}`;
                    return selector;
                },
                on: 'bottom'
            },
            text: `
                <h4>CSV Upload</h4>
                <p>To upload data via CSV, click on the "CSV Upload" tab.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#manualEntry').hide();
                    $('#manualEntry').removeClass('show active');
                    $('#csvUpload').show();
                    $('#csvUpload').addClass('show active');
                }
            }
        });

        // Financial Items - CSV Upload (Overview)
        this.tour.addStep({
            id: 'financial-items-update-data-csv-overview',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#updateDataModal .modal-content',
                on: 'bottom'
            },
            text: `
                <h4>CSV Upload</h4>
                <p>This tab is where you can update financial item data via CSV.
                Most financial institutions allow you to download your transaction history as a CSV file.
                However, you'll need to make sure your data is formatted properly before uploading it.</p>
            `,
            classes: 'shepherd-step'
        });

        // Financial Items - CSV Upload (Format Requirements)
        this.tour.addStep({
            id: 'financial-items-update-data-csv-format-requirements',
            attachTo: {
                element: '#formatRequirementsToggler',
                on: 'bottom'
            },
            text: `
                <h4>CSV Upload</h4>
                <p>Let's take a look at the CSV format requirements by clicking on the "Show Details" button.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#formatRequirementsToggler').click();
                }
            }
        });

        // Financial Items - CSV Upload (Format Details)
        this.tour.addStep({
            id: 'financial-items-update-data-csv-format-details',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#formatRequirements',
                on: 'bottom'
            },
            text: `
                <h4>CSV Upload</h4>
                <p>Follow these instructions to format your CSV data before uploading it to ensure your data is read properly.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#formatRequirementsToggler').click();
                }
            }
        });

        // Financial Items - CSV Upload (Choose File)
        this.tour.addStep({
            id: 'financial-items-update-data-csv-choose-file',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#csvFile',
                on: 'bottom'
            },
            text: `
                <h4>CSV Upload</h4>
                <p>Once you've ensured your data is properly formatted, you can click the "Choose File" button to load your CSV.</p>
                <p>Let's go ahead and load some sample transactions for our bank account.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    financialItemsManager.previewCSV('sampleFinancialItemsData');
                }
            }
        });

        // Financial Items - CSV Upload (Preview Entries)
        this.tour.addStep({
            id: 'financial-items-update-data-csv-preview-entries',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#csvPreview',
                on: 'bottom'
            },
            text: `
                <h4>CSV Preview</h4>
                <p>Alright! We've uploaded some data for our bank account via CSV.
                Now we have the chance to preview our data before importing it into our dashboard.</p>
                <p>If you see an error at this point when trying to upload a CSV file,
                you'll need to go back and double check that you've followed the formatting instructions properly.</p>
            `,
            classes: 'shepherd-step'
        });

        // Financial Items - CSV Upload (Import Data)
        this.tour.addStep({
            id: 'financial-items-update-data-csv-import-data',
            attachTo: {
                element: '#importCsvBtn',
                on: 'bottom'
            },
            text: `
                <h4>Import Data</h4>
                <p>Once you're satisfied with the CSV preview, the next step is to import the data
                into your financial item by clicking the "Import Data" button.</p>
                <p>Let's go ahead and import our data.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#importCsvBtn').click();
                }
            }
        });

        // Financial Items - CSV Upload (View Entries)
        this.tour.addStep({
            id: 'financial-items-update-data-csv-view-entries',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#existingEntriesBody',
                on: 'bottom'
            },
            text: `
                <h4>Existing Entries</h4>
                <p>Now that we've imported our data from our CSV,
                we can see our new transcations in the existing entries section.</p>
            `,
            classes: 'shepherd-step'
        });

        // Financial Items - CSV Upload (Entries Per Page)
        this.tour.addStep({
            id: 'financial-items-update-data-csv-entries-per-page',
            attachTo: {
                element: '#entriesPerPage',
                on: 'bottom'
            },
            text: `
                <h4>Existing Entries</h4>
                <p>You can change the number of entries displayed per page by using this dropdown
                (the default is 10 entries per page).</p>
            `,
            classes: 'shepherd-step'
        });

        // Financial Items - CSV Upload (Clear Entries)
        this.tour.addStep({
            id: 'financial-items-update-data-csv-clear-entries',
            attachTo: {
                element: '#clearEntriesBtn',
                on: 'bottom'
            },
            text: `
                <h4>Clearing Entries</h4>
                <p>You can also clear all existing entries by clicking the "Clear All Entries" button.
                This will permanently remove all of your existing financial data for this item, so be careful!</p>
            `,
            classes: 'shepherd-step'
        });

        // Financial Items - Update Data (Delete Entry)
        this.tour.addStep({
            id: 'financial-items-update-data-delete-entry',
            attachTo: {
                element: '.delete-entry',
                on: 'bottom'
            },
            text: `
                <h4>Removing An Entry</h4>
                <p>As we've already seen, you can remove a single entry by clicking on the trash icon.</p>
            `,
            classes: 'shepherd-step'
        });

        // Financial Items - Update Data (Pagination)
        this.tour.addStep({
            id: 'financial-items-update-data-pagination',
            attachTo: {
                element: '#updateDataModal .pagination',
                on: 'bottom'
            },
            text: `
                <h4>Navigating Existing Entries</h4>
                <p>Finally, you can navigate through your existing entries by using the next/previous buttons.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#nextPage').click();
                }
            }
        });

        // Financial Items - Update Data (Pagination2)
        this.tour.addStep({
            id: 'financial-items-update-data-pagination2',
            attachTo: {
                element: '#existingEntriesBody',
                on: 'bottom'
            },
            text: `
                <h4>Navigating Existing Entries</h4>
                <p>Entries are ordered sequentially by date, allowing you to easily navigate to find a specific entry.</p>
            `,
            classes: 'shepherd-step'
        });

        // Financial Items - Update Data (Exit)
        this.tour.addStep({
            id: 'financial-items-update-data-exit',
            attachTo: {
                element: '#updateDataModal .btn-close',
                on: 'bottom'
            },
            text: `
                <h4>Finished Updating</h4>
                <p>When you're finishing updating the data for your item, you can close the tab by clicking on the close button.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#updateDataModal .btn-close').click();
                }
            }
        });

        // Financial Items - View Update Data
        this.tour.addStep({
            id: 'financial-items-update-data-view',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#overview .card',
                on: 'bottom'
            },
            text: `
                <h4>Viewing Your Data</h4>
                <p>Now that we've entered some data for our bank account, we can see the information populated on the chart.</p>
                <p>Let's add a few more financial items to our list before we go any further.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    setTimeout(async () => {
                        await this.loadRunningTourData();
                    }, 300);
                }
            }
        });

        // Financial Items - FI Data Populated
        this.tour.addStep({
            id: 'financial-items-populated',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 700);
                });
            },
            attachTo: {
                element: '#financialItemsList',
                on: 'right'
            },
            text: `
                <h4>Viewing Your Data</h4>
                <p>There we go! Now in addition to our bank account, we've added a credit card, investment, and car loan.</p>
            `,
            classes: 'shepherd-step'
        });

        // Financial Items - FI Data View Populated
        this.tour.addStep({
            id: 'financial-items-view-populated',
            attachTo: {
                element: '#overview .card',
                on: 'bottom'
            },
            text: `
                <h4>Viewing Your Data</h4>
                <p>We can see that the data for our items is plotted nicely for us in the chart to give us a high level
                overview of our financial activity. You can think of this as your financial command center.</p>
                <p>Now let's talk about the diffent options for viewing and interacting with our financial data.</p>
            `,
            classes: 'shepherd-step'
        });

        // Chart Area Overview
        this.tour.addStep({
            id: 'chart-area',
            attachTo: {
                element: '.chart-controls',
                on: 'bottom'
            },
            text: `
                <h4>Viewing Your data</h4>
                <p>The view options menu allows you to switch between three different views:</p>
                <ul>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-chart-line text-primary me-2"></i>
                        <strong>Chart View:</strong>&nbsp;Visualize your financial trends
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-file-alt text-primary me-2"></i>
                        <strong>Summary View:</strong>&nbsp;Quick metrics and insights
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-trophy text-primary me-2"></i>
                        <strong>Goals View:</strong>&nbsp;Track your financial goals
                    </li>
                </ul>
                <p>Let's explore each view in detail!</p>
            `,
            classes: 'shepherd-step',
            /*
            when: {
                'hide': () => {
                    const initializeMilestoneManager = async () => {
                        await milestoneManager.init();
                    };
                    initializeMilestoneManager();
                }
            } */
        });

        // Chart View Features
        this.tour.addStep({
            id: 'chart-features',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#overview .card',
                on: 'bottom'
            },
            text: `
                <h4>Chart View</h4>
                <p>The chart view allows you to quickly visualize your financial data. Here you can:</p>
                <ul>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-plus text-primary me-2"></i>
                        Add financial items, goals, and milestones
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-mouse-pointer text-primary me-2"></i>
                        Click on any data point to view/edit details for that item
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-search-plus text-primary me-2"></i>
                        Use zoom controls to focus on specific periods
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-map-marker text-primary me-2"></i>
                        Click legend items to show/hide accounts
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-trophy text-primary me-2"></i>
                        View goals and milestones on your timeline
                    </li>
                </ul>
            `,
            classes: 'shepherd-step'
        });

        // Chart View Features (Add Item)
        this.tour.addStep({
            id: 'chart-features-add-item',
            attachTo: {
                element: '#addChartItemBtn',
                on: 'bottom'
            },
            text: `
                <h4>Add Items</h4>
                <p>The "Add Item" button allows you to add new financial items,
                goals, and milestones.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#addChartItemBtn').click();
                }
            }
        });

        // Chart View Features (Add Item Modal)
        this.tour.addStep({
            id: 'chart-features-add-item-modal',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#addActionModal .modal-content',
                on: 'bottom'
            },
            text: `
                <h4>Add Items</h4>
                <p>In this menu we have the option to select which type of item we want to add.</p>
            `,
            classes: 'shepherd-step'
        });

        // Chart View Features (Add Item Dropdown)
        this.tour.addStep({
            id: 'chart-features-add-item-dropdown',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#actionType',
                on: 'bottom'
            },
            text: `
                <h4>Add Items</h4>
                <p>Clicking on the dropdown gives us the option to add either a financial item, financial goal, or milestone.
                We've already seen how to add financial items, and we'll talk about goals later on. For now, let's add a milestone.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#actionType').val('milestone').change();
                }
            }
        });

        // Chart View Features (Add Item Milestone)
        this.tour.addStep({
            id: 'chart-features-add-item-milestone',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#actionType',
                on: 'bottom'
            },
            text: `
                <h4>Add Items</h4>
                <p>Milestones are ways of indicating significant events on your financial timeline - for example: buying a home,
                starting a new job, or reaching retirement. Let's go ahead and add a milestone for starting our financial journey!</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#actionContinueBtn').prop('disabled', false);
                    $('#actionContinueBtn').click();
                }
            }
        });


        // Chart View Features (Add Milestone)
        this.tour.addStep({
            id: 'chart-features-add-milestone',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#addMilestoneModal .modal-content',
                on: 'bottom'
            },
            text: `
                <h4>Add Milestone</h4>
                <p>To add a milestone, all we need to do is enter a date and a description.</p>
            `,
            classes: 'shepherd-step'
        });

        // Chart View Features (Add Milestone Date)
        this.tour.addStep({
            id: 'chart-features-add-milestone-date',
            attachTo: {
                element: '#milestoneDate',
                on: 'bottom'
            },
            text: `
                <h4>Add Milestone</h4>
                <p>We'll set the date to ${createOffsetDate(-90)} to mark the start of our financial journey.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#milestoneDate').val(createOffsetDate(-90));
                }
            }
        });

        // Chart View Features (Add Milestone Description)
        this.tour.addStep({
            id: 'chart-features-add-milestone-description',
            attachTo: {
                element: '#milestoneDescription',
                on: 'bottom'
            },
            text: `
                <h4>Add Milestone</h4>
                <p>Next we'll enter a description for our milestone. We'll enter "Started Financial Journey".</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#milestoneDescription').val('Started Financial Journey');
                }
            }
        });

        // Chart View Features (Add Milestone Save)
        this.tour.addStep({
            id: 'chart-features-add-milestone-save',
            attachTo: {
                element: '#saveMilestoneBtn',
                on: 'bottom'
            },
            text: `
                <h4>Add Milestone</h4>
                <p>Now we're ready to save our first milestone!</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#saveMilestoneBtn').click();
                }
            }
        });

        // Chart View Features (View Milestone)
        this.tour.addStep({
            id: 'chart-features-view-milestone',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#overview .card',
                on: 'bottom'
            },
            text: `
                <h4>Add Milestone</h4>
                <p>Now we can see our newly created milestone in our chart marking the start of our financial journey.
                If you've created multiple milestones, you can select them from the dropdown in the chart legend.
                You can also click an existing milestone on the chart to edit its details or delete it.</p>
            `,
            classes: 'shepherd-step'
        });

        // Chart View Features (Legend)
        this.tour.addStep({
            id: 'chart-features-legend',
            attachTo: {
                element: '#chartLegendContainer',
                on: 'bottom'
            },
            text: `
                <h4>Chart Legend</h4>
                <p>You can interact with your existing items in the chart legend by clicking on them.
                This will bring up additional details and allow you to make changes or delete items.</p>
            `,
            classes: 'shepherd-step'
        });

        // Chart View Features (Legend Item)
        this.tour.addStep({
            id: 'chart-features-legend-item',
            attachTo: {
                element: function() {
                    const newEntry = $('#chartLegendContainer .chart-legend-item').first();
                    newEntry.attr('id', 'demo-legend-item');
                    const selector = `#${newEntry.attr('id')}`;
                    return selector;
                },
                on: 'bottom'
            },
            text: `
                <h4>Chart Legend</h4>
                <p>Let's take a closer look at our Demo Chequing Account.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#chartLegendContainer .chart-legend-item').first().click();
                }
            }
        });

        // Chart View Features (Legend Item Modal)
        this.tour.addStep({
            id: 'chart-features-legend-item-modal',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#overlayFinancialItemContent',
                on: 'bottom'
            },
            text: `
                <h4>Legend Item</h4>
                <p>Here we can see details for our Demo Chequing Account. We have all the same options we saw earlier, 
                such as editing, deleting, toggling visibility, and showing additional details.</p>
                <p>Let's head back to our chart to see the rest of our options.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('.financial-item-overlay-close').click();
                }
            }
        });

        // Chart View Features (Zoom Controls)
        this.tour.addStep({
            id: 'chart-features-zoom-controls',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '.zoom-controls',
                on: 'bottom'
            },
            text: `
                <h4>Zoom Controls</h4>
                <p>The chart zoom controls allow you to zoom in and out on your timeline or reset the view.
                You can also use the mousewheel to zoom in and out if you're on a desktop or laptop.</p>
            `,
            classes: 'shepherd-step'
        });

        // Chart View Features (Point Interactivity)
        this.tour.addStep({
            id: 'chart-features-point-interactivity',
            attachTo: {
                element: '#overview .card',
                on: 'bottom'
            },
            text: `
                <h4>Interacting With Your Chart</h4>
                <p>You can interact with any of the items in your chart by clicking on them.
                This will allow you to view additional information and make changes to the item.</p>
            `,
            classes: 'shepherd-step'
        });

        // Chart View Features (Changing View)
        this.tour.addStep({
            id: 'chart-features-changing-view',
            attachTo: {
                element: '.chart-controls',
                on: 'bottom'
            },
            text: `
                <h4>Changing View</h4>
                <p>Now we're ready to take a look at the other view options - let's move on to the summary view.</p>
            `,
            classes: 'shepherd-step'
        });

        // Summary View
        this.tour.addStep({
            id: 'summary-view',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    $('#viewSummary').prop('checked', true).trigger('change');
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#overview .card',
                on: 'bottom'
            },
            text: `
                <h4>Summary View</h4>
                <p>The summary view allows you to get quick insights into your finances. In this view you can:</p>
                <ul>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-plus text-primary me-2"></i>
                        Add/remove different financial metrics
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-arrows text-primary me-2"></i>
                        Drag and drop to organize metrics
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-arrows-alt-v text-primary me-2"></i>
                        View period-over-period changes
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-clipboard-list text-primary me-2"></i>
                        Track key financial indicators
                    </li>
                </ul>
            `,
            classes: 'shepherd-step'
        });

        // Summary View (Metric Card)
        this.tour.addStep({
            id: 'summary-view-metric-card',
            attachTo: {
                element: function() {
                    const newEntry = $('#metricCards .card').first();
                    newEntry.attr('id', 'demo-metric-card');
                    const selector = `#${newEntry.attr('id')}`;
                    return selector;
                },
                on: 'bottom'
            },
            text: `
                <h4>Metric Card</h4>
                <p>Each card contains a snapshop summary for a particular metric. In this case, we can see that our net worth
                is $7,615, which is a 29.8% increase from last month.</p>
                <p>You can drag and drop these metric cards to show up in whatever order you prefer.</p>
            `,
            classes: 'shepherd-step'
        });

        // Summary View (Hide Metric Card)
        this.tour.addStep({
            id: 'summary-view-hide-metric-card',
            attachTo: {
                element: function() {
                    const newEntry = $('#metricCards .card .hide-metric').first();
                    newEntry.attr('id', 'demo-metric-card-hide-btn');
                    const selector = `#${newEntry.attr('id')}`;
                    return selector;
                },
                on: 'bottom'
            },
            text: `
                <h4>Hiding Metric Card</h4>
                <p>You can hide metric cards by clicking on this button.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#metricCards .card .hide-metric').first().click();
                }
            }
        });

        // Summary View (Metric Hidden)
        this.tour.addStep({
            id: 'summary-view-metric-hidden',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#overview .card',
                on: 'bottom'
            },
            text: `
                <h4>Viewing Your Metrics</h4>
                <p>Now we've removed the net worth metric, so we can only see our total debt and total savings.</p>
            `,
            classes: 'shepherd-step'
        });

        // Summary View (Add Metric)
        this.tour.addStep({
            id: 'summary-view-add-metric',
            attachTo: {
                element: '#addMetricDropdown',
                on: 'bottom'
            },
            text: `
                <h4>Adding Metric</h4>
                <p>We can add additional metrics to our summary tab by clicking the "Add Metric" button.</p>
            `,
            classes: 'shepherd-step'
        });

        // Summary View (Choose Metric)
        this.tour.addStep({
            id: 'summary-view-choose-metric',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#addMetricDropdown',
                on: 'bottom'
            },
            text: `
                <h4>Adding Metric</h4>
                <p>Let's add our net worth metric back to our summary tab.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#summaryView .dropdown-menu a[data-metric="networth"]').click()
                }
            }
        });

        // Summary View (Metric Added)
        this.tour.addStep({
            id: 'summary-view-metric-added',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: function() {
                    const newEntry = $('#metricCards .card').last();
                    newEntry.attr('id', 'demo-metric-card2');
                    const selector = `#${newEntry.attr('id')}`;
                    return selector;
                },
                on: 'bottom'
            },
            text: `
                <h4>Viewing Your Metrics</h4>
                <p>Now we've added the net worth metric card back to our summary tab. Pretty neat, right?</p>
            `,
            classes: 'shepherd-step'
        });

        // Summary View (Wrap Up)
        this.tour.addStep({
            id: 'summary-view-wrapup',
            attachTo: {
                element: '#overview .card',
                on: 'bottom'
            },
            text: `
                <h4>Summary View</h4>
                <p>That's it for the summary view - you can come back to this tab whenever you want to see a quick snapshot of your financial metrics.</p>
            `,
            classes: 'shepherd-step'
        });

        // Chart View Features (Changing View - Goals)
        this.tour.addStep({
            id: 'chart-features-changing-view-goals',
            attachTo: {
                element: '.chart-controls',
                on: 'bottom'
            },
            text: `
                <h4>Changing View</h4>
                <p>Now let's move on to the goals view.</p>
            `,
            classes: 'shepherd-step',
            /*
            when: {
                'hide': () => {
                    const initializeGoalManager = async () => {
                        await goalManager.init();
                    };
                    initializeGoalManager();
                }
            } */
        });

        // Goals View
        this.tour.addStep({
            id: 'goals-view',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    $('#viewGoals').prop('checked', true).trigger('change');
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#overview .card',
                on: 'bottom'
            },
            text: `
                <h4>Goals View</h4>
                <p>The goals view allows you to set and track your financial goals. In this view you can:</p>
                <ul>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-trophy text-primary me-2"></i>
                        Create budgeting, saving, and investment goals
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-tasks text-primary me-2"></i>
                        Track progress with visual indicators
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-link text-primary me-2"></i>
                        Link goals to specific accounts
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-crosshairs text-primary me-2"></i>
                        Set target dates and amounts
                    </li>
                </ul>
            `,
            classes: 'shepherd-step'
        });

        // Goals View (Add Goal)
        this.tour.addStep({
            id: 'goals-view-add-goal',
            attachTo: {
                element: '#goalsView button',
                on: 'bottom'
            },
            text: `
                <h4>Adding Goals</h4>
                <p>The "Add Goal" button allows you to set new goals to track. Let's go ahead and add our first goal.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#goalsView button').click();
                }
            }
        });

        // Goals View (Add Goal Modal)
        this.tour.addStep({
            id: 'goals-view-add-goal-modal',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#addGoalModal .modal-content',
                on: 'bottom'
            },
            text: `
                <h4>Choosing A Goal Type</h4>
                <p>When you open the menu, you'll be asked to select a goal type.
                You can choose to create a budgeting, saving, investing, retirement, or debt reduction goal.</p>
            `,
            classes: 'shepherd-step'
        });
        
        // Goals View (Select Goal Type)
        this.tour.addStep({
            id: 'goals-view-choose-goal-type',
            attachTo: {
                element: '#goalType',
                on: 'bottom'
            },
            text: `
                <h4>Choosing A Goal Type</h4>
                <p>Let's go ahead and create a saving goal.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#goalType').val('saving').change();
                }
            }
        });

        // Goals View (Saving Goal)
        this.tour.addStep({
            id: 'goals-view-saving-goal',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#savingGoalType',
                on: 'bottom'
            },
            text: `
                <h4>Sub-Goals</h4>
                <p>Once you select a goal type, you'll be able to specify a goal sub-type.
                For example, with savings goals you can choose from "Emergency Fund", "Vehicle" "Home", or "Other".</p>
                <p>Let's choose "Other" so we can enter a custom description for our savings goal.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#savingGoalType').val('other').change();
                }
            }
        });

        // Goals View (Savings - Other Type)
        this.tour.addStep({
            id: 'goals-view-saving-goal-other',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#otherGoalDescription',
                on: 'bottom'
            },
            text: `
                <h4>Entering A Goal Description</h4>
                <p>We'll need to enter a goal description - let's say we're saving for a kitchen renovation.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#otherGoalDescription').val('Kitchen Renovation');
                }
            }
        });

        // Goals View (Savings - Target)
        this.tour.addStep({
            id: 'goals-view-saving-goal-target',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#savingTargetAmount',
                on: 'bottom'
            },
            text: `
                <h4>Entering A Target Amount</h4>
                <p>Next we'll need to enter a target amount for our goal - let's say $15,000.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#savingTargetAmount').val('15000');
                }
            }
        });

        // Goals View (Savings - Date)
        this.tour.addStep({
            id: 'goals-view-saving-goal-date',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#savingTargetDate',
                on: 'bottom'
            },
            text: `
                <h4>Entering A Target Date</h4>
                <p>Then we'll need to enter a target date for our goal - let's say ${createOffsetDate(365)}.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#savingTargetDate').val(createOffsetDate(365));
                }
            }
        });

        // Goals View (Savings - Linked Items)
        this.tour.addStep({
            id: 'goals-view-saving-goal-linked-items',
            /* beforeShowPromise: () => {
                return new Promise(resolve => {
                    const maxAttempts = 10;
                    let attempts = 0;
                    
                    const checkVisibility = () => {
                        // Show only the saving details container
                        $('#savingDetails').show();
                        
                        const container = $('.linked-items-container');
                        const element = $('#item-demo_chequing');
                        
                        console.log("Attempt", attempts + 1, "of", maxAttempts);
                        console.log("Container:", container.length, "visible:", container.is(':visible'));
                        console.log("Element:", element.length, "visible:", element.is(':visible'));
                        
                        if ((container.length && container.is(':visible')) || attempts >= maxAttempts) {
                            resolve();
                        } else {
                            attempts++;
                            setTimeout(checkVisibility, 100);
                        }
                    };
                    
                    setTimeout(checkVisibility, 300); // Initial delay
                });
            }, */
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        $('#savingDetails').show();
                        resolve();
                    }, 300);
                });
            },
            attachTo: {
                element: '#savingDetails .linked-items-container',
                on: 'bottom'
            },
            text: `
                <h4>Linking Financial Items</h4>
                <p>Finally, we'll need to select which items we want to use to track this goal. Let's choose our demo chequing account.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'show': () => {
                    // Force container visibility again on show
                    $('#savingDetails').show();
                },
                'hide': () => {
                    $('#item-demo_chequing').prop('checked', true).trigger('change');
                }
            }
        });

        // Goals View (Savings - Adding Goal)
        this.tour.addStep({
            id: 'goals-view-saving-goal-add-goal',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#saveGoalBtn',
                on: 'bottom'
            },
            text: `
                <h4>Saving Your Goal</h4>
                <p>Now we're ready to save our first goal!</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#saveGoalBtn').click();
                }
            }
        });

        // Goals View (Viewing Added Goal)
        this.tour.addStep({
            id: 'goals-view-view-added-goal',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: function() {
                    const newEntry = $('#goalCards .card').first();
                    newEntry.attr('id', 'demo-goal-card');
                    const selector = `#${newEntry.attr('id')}`;
                    return selector;
                },
                on: 'bottom'
            },
            text: `
                <h4>Goal Cards</h4>
                <p>Now we can view our newly added savings goal. Each goal card contains information about
                your target amount and date, your linked financial items, and your current progress.</p>
            `,
            classes: 'shepherd-step'
        });

        // Goals View (Goal Controls)
        this.tour.addStep({
            id: 'goals-view-goal-controls',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#goalCards .goal-controls',
                on: 'bottom'
            },
            text: `
                <h4>Goal Options</h4>
                <p>You can edit or delete saved goals by using the goals controls at the top of each card. 
                Let's take a look at the edit menu.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#goalCards .edit-goal').click();
                }
            }
        });

        // Goals View (Edit Added Goal)
        this.tour.addStep({
            id: 'goals-view-edit-added-goal',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#editGoalModal .modal-content',
                on: 'bottom'
            },
            text: `
                <h4>Editing A Goal</h4>
                <p>Opening the edit menu allows you to modify your goal details and linked items.
                When you're done, click "Save Changes" to save your modifications.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#editGoalModal .btn-close').click();
                    $('#editGoalModal').find(':focus').blur();
                    $('#editGoalModal').modal('hide');

                    // Remove modal-specific classes and styles
                    $('#editGoalModal').removeClass('show');
                    $('.modal-backdrop').remove();
                        
                    // Reset body styles
                    $('body').removeClass('modal-open')
                            .css({
                                'overflow': '',
                                'padding-right': ''
                            })
                            .removeAttr('data-bs-padding-right');
                }
            }
        });

        // Goals View (Goal Wrapup)
        this.tour.addStep({
            id: 'goals-view-goal-wrapup',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '.chart-controls',
                on: 'bottom'
            },
            text: `
                <h4>Viewing Goals</h4>
                <p>In addition to viewing goals in the goals view, you can also view them in your chart. Let's head back to the chart view.</p>
            `,
            classes: 'shepherd-step',
            when: {
                'hide': () => {
                    $('#viewChart').prop('checked', true).trigger('change');
                    chartManager.updateChart();
                }
            }
        });

        // Goals View (Goals in Chart View)
        this.tour.addStep({
            id: 'goals-view-goal-chart-view',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    setTimeout(resolve, 300);
                });
            },
            attachTo: {
                element: '#overview .card',
                on: 'bottom'
            },
            text: `
                <h4>Viewing Goals</h4>
                <p>Whenever you add goals (either in the goals view, or by using the "Add Item" button here in the chart view),
                you'll see them populated on your chart.</p>
                <p>You can interact with your goals in the chart view just like your other items - either by clicking on the icon
                in the legend, or by clicking on the goal icon plotted on your chart.</p>
            `,
            classes: 'shepherd-step'
        });

        // Final Step
        this.tour.addStep({
            id: 'final',
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    // Ensure we're on chart view
                    $('#viewChart').prop('checked', true).trigger('change');
                    setTimeout(resolve, 300);
                });
            },
            text: `
                <h4>You're All Set!</h4>
                <p>That's it for the tour! Now you know how to:</p>
                <ul>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-check-circle text-success me-2"></i>
                        Navigate your dashboard
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-check-circle text-success me-2"></i>
                        Manage your financial items
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-check-circle text-success me-2"></i>
                        Use different views and features
                    </li>
                    <li class="d-flex align-items-center mb-3">
                        <i class="fas fa-check-circle text-success me-2"></i>
                        Set and track your goals
                    </li>
                </ul>
                <p>Feel free to continue exploring the sample data, or start your own journey by clicking below!</p>
                <p class="mt-3"><small>Remember, you can always start a new journey by using the reset button in the top menu.\n
                You can restart this tour at any time by using the "Guided Setup" button.</small></p>
            `,
            classes: 'shepherd-step',
            buttons: [
                {
                    text: 'Continue Exploring',
                    action: () => {
                        localStorage.setItem('guidedSetupDone', 'true');
                        this.tour.complete();
                    },
                    classes: 'btn btn-primary'
                },
                {
                    text: 'Start Your Journey',
                    action: () => {
                        localStorage.setItem('guidedSetupDone', 'true');
                        this.tour.complete();
                        this.removeHighlight();
                        this.clearTourData();
                    },
                    classes: 'btn btn-primary'
                }
            ]
        });
    },

    formatTourDataForPreview: function() {
        // Return the data in a format Papa Parse can handle
        return this.tourData.financialItems[0].data.map(item => ({
            date: item.date,
            amount: item.amount,
            description: item.description
        }));
    },

    createTourData: function() {
        const tourData = {
            financialItems: [
                {
                    id: "demo_chequing",
                    name: "Demo Chequing Account",
                    type: "account",
                    color: "#1f77b4",
                    isVisible: true,
                    currentBalance: 5243.75,
                    data: [
                        {
                            id: "demo_chequing_1",
                            date: createOffsetDate(-85),
                            amount: -1200,
                            description: "Rent Payment"
                        },
                        {
                            id: "demo_chequing_2",
                            date: createOffsetDate(-79),
                            amount: -250,
                            description: "Grocery Shopping"
                        },
                        {
                            id: "demo_chequing_3",
                            date: createOffsetDate(-75),
                            amount: 3000,
                            description: "Salary Deposit"
                        },
                        {
                            id: "demo_chequing_4",
                            date: createOffsetDate(-70),
                            amount: -150,
                            description: "Utility Bill"
                        },
                        {
                            id: "demo_chequing_5",
                            date: createOffsetDate(-63),
                            amount: -225,
                            description: "Grocery Shopping"
                        },
                        {
                            id: "demo_chequing_6",
                            date: createOffsetDate(-55),
                            amount: -1200,
                            description: "Rent Payment"
                        },
                        {
                            id: "demo_chequing_7",
                            date: createOffsetDate(-50),
                            amount: -275,
                            description: "Grocery Shopping"
                        },
                        {
                            id: "demo_chequing_8",
                            date: createOffsetDate(-45),
                            amount: 3000,
                            description: "Salary Deposit"
                        },
                        {
                            id: "demo_chequing_9",
                            date: createOffsetDate(-39),
                            amount: -165,
                            description: "Utility Bill"
                        },
                        {
                            id: "demo_chequing_10",
                            date: createOffsetDate(-35),
                            amount: -240,
                            description: "Grocery Shopping"
                        },
                        {
                            id: "demo_chequing_11",
                            date: createOffsetDate(-25),
                            amount: -1200,
                            description: "Rent Payment"
                        },
                        {
                            id: "demo_chequing_12",
                            date: createOffsetDate(-20),
                            amount: -265,
                            description: "Grocery Shopping"
                        },
                        {
                            id: "demo_chequing_13",
                            date: createOffsetDate(-15),
                            amount: 3000,
                            description: "Salary Deposit"
                        },
                        {
                            id: "demo_chequing_14",
                            date: createOffsetDate(-10),
                            amount: -155,
                            description: "Utility Bill"
                        },
                        {
                            id: "demo_chequing_15",
                            date: createOffsetDate(-7),
                            amount: -235,
                            description: "Grocery Shopping"
                        }
                    ]
                },
                {
                    id: "demo_credit",
                    name: "Demo Credit Card",
                    type: "credit",
                    color: "#d62728",
                    isVisible: true,
                    creditLimit: 5000,
                    currentBalance: 1850.25,
                    interestRate: 19.99,
                    data: [
                        {
                            id: "demo_credit_1",
                            date: createOffsetDate(-90),
                            amount: -1500,
                            description: "Initial Balance"
                        },
                        {
                            id: "demo_credit_2",
                            date: createOffsetDate(-80),
                            amount: -75,
                            description: "Restaurant Dining"
                        },
                        {
                            id: "demo_credit_3",
                            date: createOffsetDate(-71),
                            amount: -120,
                            description: "Online Shopping"
                        },
                        {
                            id: "demo_credit_4",
                            date: createOffsetDate(-63),
                            amount: 500,
                            description: "Payment"
                        },
                        {
                            id: "demo_credit_5",
                            date: createOffsetDate(-56),
                            amount: -85,
                            description: "Restaurant Dining"
                        },
                        {
                            id: "demo_credit_6",
                            date: createOffsetDate(-47),
                            amount: -150,
                            description: "Online Shopping"
                        },
                        {
                            id: "demo_credit_7",
                            date: createOffsetDate(-39),
                            amount: 600,
                            description: "Payment"
                        },
                        {
                            id: "demo_credit_8",
                            date: createOffsetDate(-30),
                            amount: -95,
                            description: "Restaurant Dining"
                        },
                        {
                            id: "demo_credit_9",
                            date: createOffsetDate(-19),
                            amount: -130,
                            description: "Online Shopping"
                        },
                        {
                            id: "demo_credit_10",
                            date: createOffsetDate(-10),
                            amount: 550,
                            description: "Payment"  
                        }
                    ]
                },
                {
                    id: "demo_investment",
                    name: "Demo Investment",
                    type: "investment",
                    color: "#2ca02c",
                    isVisible: true,
                    initialInvestment: 20000,
                    currentValue: 20850,
                    data: [
                        {
                            id: "demo_invest_1",
                            date: createOffsetDate(-90),
                            amount: 20000,
                            description: "Initial Investment"
                        },
                        {
                            id: "demo_invest_2",
                            date: createOffsetDate(-70),
                            amount: 250,
                            description: "Monthly Contribution"
                        },
                        {
                            id: "demo_invest_3",
                            date: createOffsetDate(-57),
                            amount: 175,
                            description: "Investment Return"
                        },
                        {
                            id: "demo_invest_4",
                            date: createOffsetDate(-40),
                            amount: 250,
                            description: "Monthly Contribution"
                        },
                        {
                            id: "demo_invest_5",
                            date: createOffsetDate(-28),
                            amount: -125,
                            description: "Investment Loss"
                        },
                        {
                            id: "demo_invest_6",
                            date: createOffsetDate(-10),
                            amount: 250,
                            description: "Monthly Contribution"
                        },
                        {
                            id: "demo_invest_7",
                            date: createOffsetDate(-5),
                            amount: 225,
                            description: "Investment Return"
                        }
                    ]
                },
                {
                    id: "demo_loan",
                    name: "Demo Car Loan",
                    type: "loan",
                    color: "#ff7f0e",
                    isVisible: true,
                    originalAmount: 20000,
                    currentBalance: 18750,
                    interestRate: 5.99,
                    paymentAmount: 375,
                    paymentFrequency: "monthly",
                    data: [
                        {
                            id: "demo_loan_1",
                            date: createOffsetDate(-90),
                            amount: 20000,
                            description: "Initial Loan Amount"
                        },
                        {
                            id: "demo_loan_2",
                            date: createOffsetDate(-70),
                            amount: -375,
                            description: "Loan Payment"
                        },
                        {
                            id: "demo_loan_3",
                            date: createOffsetDate(-40),
                            amount: -375,
                            description: "Loan Payment"
                        },
                        {
                            id: "demo_loan_4",
                            date: createOffsetDate(-10),
                            amount: -375,
                            description: "Loan Payment"
                        }
                    ]
                }
            ],
            /*
            financialGoals: [
                {
                    id: "demo_goal_1",
                    type: "saving",
                    subType: "emergency_fund",
                    goalName: "Emergency Fund",
                    createdAt: "2024-01-01",
                    targetAmount: 15000,
                    currentAmount: 5243.75,
                    targetDate: "2024-12-31",
                    linkedItems: ["demo_chequing"]
                },
                {
                    id: "demo_goal_2",
                    type: "debt",
                    subType: "payoff_debt",
                    goalName: "Pay Off Car Loan",
                    createdAt: "2024-01-01",
                    targetAmount: 0,
                    currentAmount: 18750,
                    initialAmount: 20000,
                    targetDate: "2025-12-31",
                    linkedItems: ["demo_loan"]
                }
            ],
            financialMilestones: [
                {
                    id: "demo_milestone_1",
                    date: "2024-01-01",
                    description: "Started Financial Journey"
                }
            ], */
            visibleMetrics: ["networth", "debt", "savings"]
        };
        return tourData;
    },

    loadTourData: function() {
        localStorage.setItem('financialItems', JSON.stringify(this.tourData.financialItems));
        localStorage.setItem('financialGoals', JSON.stringify(this.tourData.financialGoals));
        localStorage.setItem('financialMilestones', JSON.stringify(this.tourData.financialMilestones));
        localStorage.setItem('visibleMetrics', JSON.stringify(this.tourData.visibleMetrics));

        // Initialize managers
        (async () => {
            // Initialize managers
            const initializeAll = async () => {
                await financialItemsManager.init();
                await goalManager.init();
                await metricsManager.init();
                await milestoneManager.init();
                await chartManager.init();
            };
            await initializeAll();
        })();
        setTheme('light');
    },

    loadRunningTourData: async function() {
        localStorage.removeItem('financialItems');

        // Load metric cards
        localStorage.setItem('visibleMetrics', JSON.stringify(this.tourData.visibleMetrics));
        metricsManager.loadSavedState();

        // Set financial items
        financialItemsManager.items = this.tourData.financialItems;
        
        (async () => {
            // Populate metrics
            const populateMetrics = async () => {
                financialItemsManager.items.forEach(function(item) {
                    const { metrics, currentValue, currentBalance } = financialItemsManager.calculateMetrics(item);
                    item.metrics = metrics;
                    if (item.type === ('account' || 'investment' || 'asset')) {
                        item.currentValue = currentValue;
                    } else {
                        item.currentBalance = currentBalance;
                    }
                });
            };
            await populateMetrics();
        })();

        financialItemsManager.saveToLocalStorage();
        financialItemsManager.renderItems();
    },

    clearTourData: function() {
        localStorage.removeItem('financialItems');
        localStorage.removeItem('financialItemsOrder');
        localStorage.removeItem('financialGoals');
        localStorage.removeItem('financialMilestones');
        localStorage.removeItem('visibleMetrics');
        localStorage.removeItem('theme');

        // Reset any tour-related UI elements
        $('.tour-highlight').remove();
        $('.tour-overlay').remove();
        $('.shepherd-modal-overlay-container').remove();

        // Reset view
        $('#viewChart').prop('checked', true);
        $('#chartView').addClass('active');
        $('#summaryView').removeClass('active');
        $('#goalsView').removeClass('active');

        // On mobile, collapse the navigation menu
        if ($(window).width() <= 768) {
            const navbarCollapse = document.querySelector('#navbarNav');
            if (navbarCollapse && navbarCollapse.classList.contains('show')) {
                $('.navbar-toggler').click();
            }
        }

        // Initialize Managers
        (async () => await initializeManagers())();

        setTheme('light');
    },

    reset: function() {
        // Reset tour progress
        if (this.tour) {
            this.tour.complete();
        }
        
        // Reset don't show again preference
        $('#dontShowAgain').prop('checked', false);
        
        // Reset any tour-related UI elements
        $('.tour-highlight').remove();
        $('.tour-overlay').remove();
        $('.shepherd-modal-overlay-container').remove();
    }
};
/* TOUR MANAGER CONSTRUCTOR ENDS */


// Takes an offset (in days) from the current date - negative offset for past dates
// Returns a date in YYYY-MM--DD format 
function createOffsetDate(daysOffset) {
    const timestamp = new Date().getTime();
    const offsetInMilliseconds = daysOffset * 24 * 60 * 60 * 1000;
    return new Date(timestamp + offsetInMilliseconds).toISOString().split('T')[0];
}

function parseDate(dateStr) {
    // Handle YYYYMMDD format
    if (dateStr.length === 8) {
        return `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
    }
    return dateStr;
}

function formatDate(dateString) {
    // Parse the date components from the dateString
    const dateParts = dateString.split('-'); // Assuming the date string is in 'YYYY-MM-DD' format
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // Months are zero-based in JavaScript
    const day = parseInt(dateParts[2], 10);
    
    // Create a new Date object without any timezone effects
    const localDate = new Date(year, month, day);

    // Format the date to the desired locale
    const formattedDate = localDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    return formattedDate;
}

function formatCurrency(amount, includeDecimals) {
    if (includeDecimals) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    } else {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }
}

// Confirmation popup modal
function showConfirmation(title, message) {
    return new Promise((resolve) => {
        const $modal = $('#confirmationModal');
        
        // Set content
        $modal.find('.modal-title').text(title);
        $modal.find('.modal-body').text(message);
        
        // Handle confirm button
        const handleConfirm = () => {
            $modal.modal('hide');
            cleanup();
            resolve(true);
        };
        
        // Handle cancel/dismiss
        const handleCancel = () => {
            cleanup();
            resolve(false);
        };
        
        // Cleanup function
        const cleanup = () => {
            $('#confirmButton').off('click', handleConfirm);
            $modal.off('hidden.bs.modal', handleCancel);
        };
        
        // Bind events
        $('#confirmButton').on('click', handleConfirm);
        $modal.on('hidden.bs.modal', handleCancel);
        
        // Show modal
        $modal.modal('show');
    });
}

// Function to set light/dark theme preference
function setTheme(theme) {
    $('html').attr('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update icon
    const icon = theme === 'dark' ? 'fa-sun' : 'fa-moon';
    $('#darkModeToggle i').removeClass('fa-sun fa-moon').addClass(icon);

    // Update chart theme if chartManager exists
    if (window.chartManager) {
        chartManager.updateChartTheme();
    }
}

// Reset all data, including preferences
function resetAllData() {
    localStorage.removeItem('financialItems');
    localStorage.removeItem('financialItemsOrder');
    localStorage.removeItem('financialGoals');
    localStorage.removeItem('financialMilestones');
    localStorage.removeItem('visibleMetrics');
    localStorage.removeItem('theme');
    localStorage.removeItem('guidedSetupDone');
    localStorage.removeItem('dontShowGuidedSetup');

    // Reset view
    $('#viewChart').prop('checked', true);
    $('#chartView').addClass('active');
    $('#summaryView').removeClass('active');
    $('#goalsView').removeClass('active');

    // On mobile, collapse the navigation menu
    if ($(window).width() <= 768) {
        const navbarCollapse = document.querySelector('#navbarNav');
        if (navbarCollapse && navbarCollapse.classList.contains('show')) {
            $('.navbar-toggler').click();
        }
    }

    // Initialize Managers
    (async () => await initializeManagers())();
    
    // Update theme
    setTheme('light');
}

async function initializeManagers() {    
    const skipTour = localStorage.getItem('dontShowGuidedSetup') || false;

    // Reset each manager before reinitializing
    if (window.financialItemsManager) financialItemsManager.reset();
    if (window.goalManager) goalManager.reset();
    if (window.metricsManager) metricsManager.reset();
    if (window.milestoneManager) milestoneManager.reset();
    if (window.tourManager) tourManager.reset();
    if (window.chartManager) chartManager.reset();
    
    (async () => {
        // Initialize managers
        const initializeAll = async () => {
            await financialItemsManager.init();
            window.financialItemsManager = financialItemsManager;
            await goalManager.init();
            window.goalManager = goalManager;
            await metricsManager.init();
            window.metricsManager = metricsManager;
            await milestoneManager.init();
            window.milestoneManager = milestoneManager;
            if (!skipTour) {
                await tourManager.init();
                window.tourManager = tourManager;
            }
            await chartManager.init();
            window.chartManager = chartManager;
        };
        await initializeAll();
    })();
}